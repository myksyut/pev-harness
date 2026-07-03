---
description: Run full Plan-Execute-Verify pipeline for a coding task
---

# /pev

PEV harnessのメインコマンド。Plan → Execute → Verify を順に実行する。

## Usage

```text
/pev <task description>
/pev <task> --strict                 # dual review有効化
/pev <task> --parallel               # 独立ファイル変更を並列実行
/pev <linear-issue-url>              # Linear Issueから自動展開 (v1.2+)
/pev <linear-issue-url> --strict     # 上記 + dual review
/pev <task> --e2e                    # E2E verify を強制起動 (v1.4+)
/pev <task> --no-e2e                 # E2E verify を強制 skip (v1.4+)
/pev <task> --force-auto             # permissionMode default でも Gate A を skip して Phase 2/3 自動進行 (v1.6+)
/pev <task> --expect-fail            # FAIL 想定タスク (dog food fixture / regression)、 retry loop を skip して即 escalate path (v1.8+)
/pev <task> --executor-mode=codex    # Execute phase を OpenAI Codex CLI に委譲 (= default、 v3.5.0+)
/pev <task> --executor-mode=claude   # Execute phase を Claude executor で実行 (= codex default の override)
```

## Linear URL 検出 (v1.2 で追加)

引数が以下の正規表現にマッチする場合、`pev-linear-sync` skill (inbound) が起動して Linear Issue → spec を構築する:

```regex
linear\.app/[^/]+/issue/([A-Z]+-\d+)
```

抽出した identifier (例: `ENG-123`) を `artifacts/linear/issue_id.txt` に保存。`pev-spec-template` をスキップして直接 planner に Linear-sourced spec を渡す。

Linear MCP plugin (`@plugin_linear_linear`) が install済みかつ認証済みであることが前提。 不在時は warning を出して通常 flow にfallback。

## Model tiering (v4.2.0+)

`/pev` を実行する main session は **orchestrator (Fable 5、 settings.json の `"model": "claude-fable-5"`)** として振る舞う。 orchestrator の単価は高い (Opus の 2 倍) ため、 このコマンドの実装 (Step 1〜7) は以下を厳守する:

- orchestrator が行うのは **artifacts の parse (jq / grep)、 flag 判定、 agent dispatch、 `/goal` set、 recap 追記** のみ
- **実装 file (src/ / tests/) を orchestrator turn で Read しない**。 codebase 理解が必要な作業はすべて phase agent (triage / planner / executor / verifier) に委譲する
- **orchestrator turn で code 変更・test 実行をしない** (= 「小さい修正だから直接やる」 は禁止、 Execute phase へ)
- 各 phase agent の model / effort は `agents/*.md` frontmatter が正 (Triage=sonnet low / Plan=opus xhigh / Execute=sonnet high or codex / Verify=sonnet xhigh)。 orchestrator が dispatch 時に model を fable へ引き上げない
- **phase agent の dispatch は同期 (foreground) Task で行う**。 background dispatch は禁止 — headless (`-p`) 実行では background task の待機上限 (default 600 秒) で session ごと terminate され、 実行中の phase が成果物未着地のまま切断される (harness-effect-v19 / F_v19_6)。 phase は元々逐次依存 (Plan → Execute → Verify) なので並行化の利得もない

規約詳細: `rules/pev-conventions.md` §7、 費用モデル: `experiments/v4.2-fable-orchestrator-cost.md`。

## フロー (v3.0+)

1. **引数判定**:
   - Linear URL → `pev-linear-sync` inbound
   - 自然文 → そのまま task description として使用
2. **Phase 0 (Triage、 v3.0+)**: triage agent → `artifacts/triage.json` で Plan 必要性判定
   - `decision = plan_required` → Step 3 (Plan) へ
   - `decision = plan_skip` → Step 4 (Execute) へ直行
3. **Phase 1 (Plan、 on-demand)**: planner agent → `artifacts/plan.md` (= Triage が plan_required と判定した場合のみ)
4. **Gate L (Linear issue-first、 v3.3.0+、 v3.3.1 で配置修正)**: `.linear-config.yml` 存在時、 Gate A の前に Linear issue 作成 + branch checkout
5. **Gate A**: `permissionMode` 判定で auto / 停止 / 終了 を分岐 (= Plan が走った場合のみ)
6. **Phase 2 (Execute)**: executor agent → コード変更 + `artifacts/execute.log`
   - plan.md があれば計画ベース、 なければ task description + cwd context ベース
   - Gate L で branch checkout 済みなら Linear 発行 branch 上で実装
   - **executor mode (v3.5.0+)**: default は `codex` (Execute phase の実 file 編集を Codex CLI に委譲、 executor agent は wrapper として execute.log / DRY review を担当)。 `--executor-mode=claude` / `PEV_EXECUTOR_MODE=claude` で Claude native に override。 codex 未 setup 時は claude に自動 degrade
7. **Gate B**: Stop hook が verifier を促す
8. **Phase 3 (Verify)**: verifier agent (`--strict` 時は `pev-dual-review`) → `artifacts/verify.json`
9. **Retry Gate (/goal 駆動)**: `/goal` が「verifier (別 Task) の独立 PASS + 生 test 出力 exit 0」 を condition に retry を自走駆動 (max `PEV_MAX_RETRIES`)。 verifier の dispatch は pev が握り続ける。 `--expect-fail` / hooks 無効環境では `/goal` を起動せず verify 1 回で停止 (v4.1.0 で `/goal` 前提化、 legacy retry_count は撤去)

### Flag による flow override (v3.0+)

- `--with-plan`: Triage を skip して必ず Plan を起動 (= v2.x 互換挙動)
- `--no-plan`: Triage を skip して必ず Plan も skip (= 最短 path)
- 指定なし: Triage の判定に従う (= default、 v3.0 推奨)

### Executor mode (v3.5.0+)

`--executor-mode` は Phase 2 (Execute) の実装担当を切り替える。 Triage / Plan の flow には影響しない (= flow override とは独立の軸):

- `--executor-mode=codex` (default): 実 file 編集を OpenAI Codex CLI に委譲。 executor agent は wrapper として残り、 `execute.log` / DRY self-review / judgment trace / Mode B Self-Clarify を担当
- `--executor-mode=claude`: Claude executor agent が native に実装 (= codex default の override)
- 優先順: `--executor-mode` flag > `PEV_EXECUTOR_MODE` env var > settings.json default (`codex`)
- codex CLI が未 setup / 未認証の場合、 自動で Claude native 実装に degrade (= graceful fallback)。 setup は `/pev-init-codex`
- `--parallel` と併用された場合、 codex mode が優先 (codex は 1 invocation で複数 file 編集可、 並列 subprocess 化しない)

## Implementation

### Step 1 — Task initialization

```bash
# 既存タスクの検出
if [ -f artifacts/.task_id ]; then
  echo "[PEV] Existing task: $(cat artifacts/.task_id)"
  echo "[PEV] Run '/pev-status' or '/pev-status --clean' first."
  exit 1
fi

# 新規タスク発行
mkdir -p artifacts
TASK_ID="$(date +%s)-$(openssl rand -hex 4 2>/dev/null || printf '%04x%04x' $RANDOM $RANDOM)"
echo "$TASK_ID" > artifacts/.task_id
mkdir -p ~/.claude/pev/$TASK_ID
echo "[PEV] Task started: $TASK_ID"
```

### Step 1.5 — Phase 0 (Triage、 v3.0+)

- flag: `--with-plan` → `plan_required` 扱い (Triage skip) / `--no-plan` → `plan_skip` 扱い (Triage skip)
- flag なし: **必ず triage agent を invoke する** (main が prompt の表面解釈で「対象不在」 等を自走判定して Triage を skip するのは禁止、 v3.0.5+)。 decision は `jq -r '.decision' artifacts/triage.json` で受領
- `plan_required` → Step 2 へ / `plan_skip` → Step 4 (Execute) へ直行 (Gate A は skip) / `task_infeasible` (v3.0.5+) → reasoning + missing targets を user に提示、 recap.log に記録して exit 0 (Plan / Execute / Verify を起動しない)
- **Defensive default**: triage 無応答 / parse 失敗 / 不明 decision は `plan_required`
- bash 参考実装 (必要時のみ Read): `skills/pev-pipeline/references/pev-implementation.md`

### Step 2 — Phase 1 (Plan、 on-demand、 v3.0+)

Triage decision が `plan_required` の場合のみ起動。 `plan_skip` ならこの Step 全体を skip して Step 4 へ。

planner agent (model: opus, effort: xhigh) を起動 → `artifacts/plan.md` 出力。 plan.md 冒頭に「## 確認質問」 が出力された場合は、 user との対話で確定後に Goal/Constraints/AC 等を確定する (= v3.0 で質問返しは必須機能)。

### Step 2.5 — Gate L (Linear issue-first、 v3.3.0+、 v3.3.1 で配置修正)

`.linear-config.yml` が cwd に **存在する時のみ** 発動 (不在なら本 Step 全体を skip)。 **Gate A の前に** Linear issue を作成し、 Linear 発行 branch を checkout する (issue-first。 v3.3.1 で Gate A 前へ配置修正 = F_v15_1、 default mode 停止でも issue + branch が準備済になる)。

- inbound case (`/pev <linear-url>`) は issue 作成 skip、 branch checkout のみ。 git 管理外 cwd は checkout skip
- Linear MCP unavailable / OAuth 未認証 / headless で OAuth 完了不能 → **degraded mode** (warning + skip、 pipeline は止めない)。 headless で OAuth URL を出して停止するのは禁止 (F_v17_1)
- 手順・issue body 組み立て・副作用の詳細と bash 参考実装: `skills/pev-pipeline/references/pev-implementation.md` + `skills/pev-linear-sync/SKILL.md` (Linear path に入った時のみ Read)

### Step 3 — Gate A (permissionMode判定、**絶対遵守**)

**規約**: Gate A の判断は `/pev` コマンド (この Step 3) の責任。planner agent は plan.md を書き終えたらそこで完全停止する。「ユーザーが続行したいはず」のような推論で executor を勝手に起動してはならない (rules/pev-conventions.md "Gate respect" 参照)。

- `permissionMode` を `.claude/settings.local.json` → `.claude/settings.json` の順で読む (未設定は `default`)
- `--force-auto` 指定時: mode に関わらず recap.log に override を記録して Step 4 へ (user/上位 command の explicit flag のみ有効。 planner 自身の override 判断は禁止)
- `auto` → Step 4 へ自動進行 / `plan` → plan.md を表示して exit 0 / `default` (未設定含む) → **必ず exit 0 で停止**: plan.md を表示し「/pev-execute で続行、 もしくは --force-auto で再実行」 を案内する
- **executor 起動条件**: `auto` or `--force-auto` のみ。 agent が「ユーザー意図」 を理由に Step 4 へ進むことは禁止 (rules/pev-conventions.md §0 Gate respect)
- bash 参考実装と `--force-auto` 使い分け規約: `skills/pev-pipeline/references/pev-implementation.md`

### Step 4 — Phase 2 (Execute)

executor agent (model: sonnet, effort: high) を起動 (`--parallel` 時は最大3並列)。
コード変更 + `artifacts/execute.log` 記録。 **Gate L で branch checkout 済みなら、 実装は Linear 発行 branch 上で走る**。

**executor mode 解決 (v3.5.0+)**: 優先順 `--executor-mode` flag > `PEV_EXECUTOR_MODE` env > settings default (`codex`)。 解決値を `PEV_EXECUTOR_MODE` として executor に渡す。 `codex` の場合 executor agent は Codex delegation mode (`agents/executor.md`) で起動、 codex 未 setup / 未認証なら自動で Claude native に degrade (degrade は recap.log に記録)。 bash 参考実装: `skills/pev-pipeline/references/pev-implementation.md`。

### Step 5 — Gate B (Stop hookで自動)

Stop hook が `artifacts/execute.log` 存在を検出し、recap.log にPhase 2完了エントリ追記 + `/pev-verify` を促す。

**auto / `--force-auto` path (v4.2.1+、 F_v19_1)**: Stop hook 任せにせず、 orchestrator が Execute 完了を確認したら **同 turn で verifier を dispatch する**。 headless (`-p`) では Stop hook 経由の promotion が発火せず Verify が丸ごと skip される事故が実測されたため。

### Step 6 — Phase 3 (Verify)

verifier agent。`--strict` 指定時は `pev-dual-review` skill 経由でReviewer A/B並列。
`artifacts/verify.json` 出力。

### Step 7 — Retry Gate (/goal 駆動)

retry の自走駆動は Claude Code 公式 `/goal` primitive が担う (v4.1.0 で `/goal` 前提化、 legacy retry_count ループは撤去)。 ただし **verifier の独立 dispatch は pev が握り続ける**: `/goal` evaluator は会話テキストしか読めず executor の自己申告と verifier の検証を区別できないため、 「verifier を別 Task として起動する」 ところは `/goal` に丸投げせず pipeline が握る。 `/goal` はループの継続/停止判定のみ。

必須 Claude Code version は v2.1.156 で `/goal` の floor (v2.1.139) を上回るため version check は不要 (全 user が `/goal` 利用可)。

#### /goal を set (Phase 3 verify の後)

pipeline は Phase 3 (verify) の **後**、 以下の goal を set する (= 以降のターンを公式 evaluator が駆動):

```text
/goal The pev verifier agent — dispatched as a SEPARATE Task by the pipeline, NOT the
executor's self-report — has written artifacts/verify.json with "verdict":"PASS", and the
conversation shows the raw test command output exiting 0 produced by that verifier. While
still FAIL: re-plan, re-implement, then RE-DISPATCH THE VERIFIER AS A SEPARATE TASK — never
accept the implementer's own claim. Stop and hand back after PEV_MAX_RETRIES (default 3)
verify rounds.
```

各 goal ターンで pipeline が踏む手順 (**厳守**):

1. (FAIL からの再入時のみ) planner を再起動し plan.md を diff ベースで更新
2. executor で実装 (Phase 2)
3. **verifier を必ず別 Task として dispatch** (Phase 3) — executor ターン内で verify.json を書く self-report は禁止
4. verifier が verify.json + 生 test 出力 (exit code 含む) を **会話に明示提示** (`agents/verifier.md` の会話提示契約)
5. `/goal` evaluator が「verifier 作の PASS + exit 0」 を読んで継続/停止を判定。 PASS なら goal 自動 clear、 FAIL なら次ターンへ。 `PEV_MAX_RETRIES` round で hand back

PASS 時は recap.log に `Task complete via /goal (verdict: PASS)`、 `PEV_MAX_RETRIES` 到達時は `handed back` を記録して `/pev-status --escalate` を案内する。

#### 例外 — retry を回さない path (`--expect-fail` / hooks 無効環境)

以下のいずれかでは `/goal` を **起動せず**、 verify 1 回で停止する (retry なし):

- `--expect-fail` 指定、 もしくは plan.md に `expectFail: true` メタ (= FAIL が想定済の fixture。 PASS した場合は UNEXPECTED PASS として recap.log に warning)
- hooks 無効環境 (`disableAllHooks` / `allowManagedHooksOnly`) — `/goal` evaluator が動かないため verify 1 回 + escalate 案内

verdict 別の recap 記録・`--expect-fail` 使い分け規約・bash 参考実装: `skills/pev-pipeline/references/pev-implementation.md` (該当 path に入った時のみ Read)。
