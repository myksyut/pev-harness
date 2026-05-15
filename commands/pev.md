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
```

## Linear URL 検出 (v1.2 で追加)

引数が以下の正規表現にマッチする場合、`pev-linear-sync` skill (inbound) が起動して Linear Issue → spec を構築する:

```regex
linear\.app/[^/]+/issue/([A-Z]+-\d+)
```

抽出した identifier (例: `ENG-123`) を `artifacts/linear/issue_id.txt` に保存。`pev-spec-template` をスキップして直接 planner に Linear-sourced spec を渡す。

Linear MCP plugin (`@plugin_linear_linear`) が install済みかつ認証済みであることが前提。 不在時は warning を出して通常 flow にfallback。

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
7. **Gate B**: Stop hook が verifier を促す
8. **Phase 3 (Verify)**: verifier agent (`--strict` 時は `pev-dual-review`) → `artifacts/verify.json`
9. **Retry Gate**: PASS → 完了 / FAIL → planner (もしくは Triage) に戻る (max 3回)

### Flag による flow override (v3.0+)

- `--with-plan`: Triage を skip して必ず Plan を起動 (= v2.x 互換挙動)
- `--no-plan`: Triage を skip して必ず Plan も skip (= 最短 path)
- 指定なし: Triage の判定に従う (= default、 v3.0 推奨)

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
echo "0" > artifacts/.retry_count
mkdir -p ~/.claude/pev/$TASK_ID
echo "[PEV] Task started: $TASK_ID"
```

### Step 1.5 — Phase 0 (Triage、 v3.0+)

```bash
# --with-plan / --no-plan flag を check
WITH_PLAN=false
NO_PLAN=false
[[ "$*" == *"--with-plan"* ]] && WITH_PLAN=true
[[ "$*" == *"--no-plan"* ]] && NO_PLAN=true

if [ "$WITH_PLAN" = "true" ]; then
  echo "[PEV] --with-plan: Triage skip、 Plan を必ず起動"
  TRIAGE_DECISION="plan_required"
elif [ "$NO_PLAN" = "true" ]; then
  echo "[PEV] --no-plan: Triage skip、 Plan を必ず skip"
  TRIAGE_DECISION="plan_skip"
else
  # default: Triage agent を起動して判定
  echo "[PEV] Phase 0 (Triage): Plan 必要性を判定..."
  # triage agent (model: sonnet, effort: low) を起動、 artifacts/triage.json を生成
  # ※ Agent 起動の実装詳細は claude code internal、 ここでは概念的に記述
  invoke_triage_agent "$TASK_DESCRIPTION" "$(pwd)"
  TRIAGE_DECISION=$(jq -r '.decision' artifacts/triage.json 2>/dev/null)
fi

echo "[PEV] Triage decision: $TRIAGE_DECISION"

# task_infeasible の場合は user 通知して停止 (v3.0.5+)
if [ "$TRIAGE_DECISION" = "task_infeasible" ]; then
  REASONING=$(jq -r '.reasoning' artifacts/triage.json 2>/dev/null)
  AMBIGUITY=$(jq -r '.ambiguity_signals[]' artifacts/triage.json 2>/dev/null)
  echo "[PEV] Phase 0 (Triage): task_infeasible — タスクの対象が cwd に見つかりません"
  echo "[PEV] reasoning: $REASONING"
  echo "[PEV] missing targets:"
  echo "$AMBIGUITY" | sed 's/^/  - /'
  echo "[PEV] task description を確認してください、 PEV pipeline は起動しません"
  echo "[$(date -u +%FT%TZ)] Phase 0 (Triage) complete: task_infeasible → exit" >> artifacts/recap.log
  exit 0
fi

# Plan skip の場合は Step 4 (Execute) へ直行
if [ "$TRIAGE_DECISION" = "plan_skip" ]; then
  echo "[$(date -u +%FT%TZ)] Phase 0 (Triage) complete: plan_skip → direct Execute" >> artifacts/recap.log
  # Step 4 (Execute) へジャンプ
fi
```

**triage decision の解釈**:

- `plan_required`: Step 2 (Phase 1 Plan) → Step 3 (Gate A) → Step 4 (Execute) → ...
- `plan_skip`: Step 4 (Execute) へ直行、 Gate A は skip (= Plan がないので permissionMode 判定の文脈なし)
- `task_infeasible` (v3.0.5+): user 通知して exit、 Plan / Execute / Verify は起動しない

**重要 (v3.0.5+)**: main session (= /pev コマンド自身) は **必ず triage agent を invoke する**。 prompt の表面解釈で「対象不在」 と自走判定して triage を skip するのは禁止。 task feasibility check は triage agent の責務 (= triage.json に `task_infeasible` を出力)、 main の責務は triage の decision を受領して分岐するのみ。

**Defensive default**: triage agent が応答しない / parse 失敗 / 不明な decision の場合、 default は `plan_required` (= 過剰な skip を避けて minimal interpretation 漏れを防ぐ)。

### Step 2 — Phase 1 (Plan、 on-demand、 v3.0+)

Triage decision が `plan_required` の場合のみ起動。 `plan_skip` ならこの Step 全体を skip して Step 4 へ。

planner agent (model: opus, effort: xhigh) を起動 → `artifacts/plan.md` 出力。 plan.md 冒頭に「## 確認質問」 が出力された場合は、 user との対話で確定後に Goal/Constraints/AC 等を確定する (= v3.0 で質問返しは必須機能)。

### Step 2.5 — Gate L (Linear issue-first、 v3.3.0+、 v3.3.1 で配置修正)

`.linear-config.yml` が cwd に存在する場合、 **Gate A の前に必ず Linear issue を作成し、 Linear が発行する branch 名を checkout する**。 「実装前に必ず issue を立てる」 を formal channel として強制。

**v3.3.1 の配置修正 (F_v15_1)**: v3.3.0 では Gate L を Gate A の **後** (Step 3.5) に置いたが、 Gate A は `permissionMode=default` で `exit 0` 停止するため Gate L が dead path になっていた。 v3.3.1 で Gate A の **前** (Step 2.5) に移動。 これにより default mode で Gate A 停止しても **issue + branch は既に準備済**、 user が `/pev-execute` を打った時に Linear branch 上で実装が走る。

```bash
# .linear-config.yml の存在 check (Gate A の前 = Triage / Plan の直後)
if [ -f .linear-config.yml ]; then
  # 既に Linear issue がある場合 (= inbound case、 もしくは再実行) は issue 作成 skip
  if [ -f artifacts/linear/issue_id.txt ]; then
    BRANCH=$(cat artifacts/linear/branch_name.txt 2>/dev/null)
    if [ -n "$BRANCH" ]; then
      echo "[PEV] Gate L: 既存 Linear issue branch に checkout: $BRANCH"
      git checkout "$BRANCH" 2>/dev/null || echo "[PEV] Gate L: branch checkout skip (git 管理外 or branch なし)"
    fi
  else
    # issue-first: pev-linear-sync の Direction 1.5 を invoke
    echo "[PEV] Gate L: .linear-config.yml 検出 — 実装前に Linear issue を作成します"
    # pev-linear-sync skill (issue-first direction) を起動:
    #   1. .linear-config.yml から workspace / team.id を読む
    #   2. plan.md (あれば) or task description + triage.json から issue body 組み立て
    #   3. mcp__plugin_linear_linear__save_issue で新規 issue 作成
    #   4. issue の branchName を取得
    #   5. git checkout -b <branchName>
    #   6. artifacts/linear/{issue_id,issue_url,branch_name}.txt + sync_state.json 書き出し
    invoke_pev_linear_sync_issue_first
    BRANCH=$(cat artifacts/linear/branch_name.txt 2>/dev/null)
    echo "[PEV] Gate L: Linear issue 作成完了、 branch=$BRANCH で実装を進めます"
    echo "[$(date -u +%FT%TZ)] Gate L: Linear issue created, branch=$BRANCH" >> artifacts/recap.log
  fi
fi
```

**Gate L の規約**:

- `.linear-config.yml` が **存在する時のみ** 必須。 不在なら この Gate 全体を skip して従来 flow (= OSS user / sample-project への影響なし)
- **配置 (v3.3.1+)**: Gate A の **前**。 plan_required path では `Plan → Gate L → Gate A`、 plan_skip path では `Triage → Gate L → Execute` (= Gate A は元々 skip)
- inbound case (= `/pev <linear-url>`) は既に `issue_id.txt` があるので issue 作成は skip、 branch checkout のみ
- **degraded mode (v3.3.3+ で refine、 F_v17_2)**: 以下のいずれも degraded mode (= warning を出して issue 作成 / branch checkout を skip、 pipeline は止めない):
  - Linear MCP plugin が unavailable (= 完全に install されていない)
  - Linear MCP が **OAuth 未認証 / token expired** (= configured but unauthed)
  - **headless (`-p`) mode で起動されており OAuth フローを完了できない** — この場合 OAuth 認証 URL を出して停止するのは **禁止**。 headless subprocess はブラウザ OAuth を完了できないため (harness-effect-v17 / F_v17_1)、 degraded mode に倒して通常 flow で続行する
- git 管理外の cwd では branch checkout を skip (= issue 作成のみ)
- Plan が走った場合 (= plan_required) は plan.md の Goal/Constraints/AC を issue body に、 plan_skip (= Mode B) なら task description + triage.json を issue body に
- **副作用**: default mode で user が plan.md レビュー後に「やめる」 と判断しても Linear issue は残る。 issue は「実装予定 task」 を表すので意味的に問題なし (= user が手動 archive)。 「default mode で Gate L が dead」 (v3.3.0 バグ) より遥かに軽微

### Step 3 — Gate A (permissionMode判定、**絶対遵守**)

**規約**: Gate A の判断は `/pev` コマンド (この Step 3) の責任。planner agent は plan.md を書き終えたらそこで完全停止する。「ユーザーが続行したいはず」のような推論で executor を勝手に起動してはならない (rules/pev-conventions.md "Gate respect" 参照)。

```bash
# .claude/settings.json または settings.local.json から permissionMode を読む
MODE=$(grep -oh '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' \
       .claude/settings.local.json .claude/settings.json 2>/dev/null \
       | head -1 | cut -d'"' -f4)
MODE=${MODE:-default}

# v1.6+ : --force-auto フラグで explicit override
# user が「default mode だが今回だけ自動進行したい」 ケース (dog food / CI 自動化 等) に使う。
# Gate A 規約 (default mode は停止) を守りつつ、 明示的な user override channel を提供。
FORCE_AUTO=false
[[ "$*" == *"--force-auto"* ]] && FORCE_AUTO=true

if [ "$FORCE_AUTO" = "true" ]; then
  echo "[PEV] Gate A: --force-auto detected — overriding permissionMode=$MODE, proceeding to Phase 2"
  echo "[$(date -u +%FT%TZ)] Gate A overridden by --force-auto (original mode: $MODE)" >> artifacts/recap.log
  # → Step 4 (Phase 2 Execute) へ進行
else
  case "$MODE" in
    auto)
      echo "[PEV] Gate A: auto mode — proceeding to Phase 2"
      # → Step 4 (Phase 2 Execute) へ自動進行
      ;;
    plan)
      echo "[PEV] Gate A: plan mode — STOP. Plan phase complete. Pipeline terminated."
      cat artifacts/plan.md
      exit 0
      ;;
    default|*)
      echo "[PEV] Gate A: default mode — STOP. Plan phase complete."
      echo "[PEV] DO NOT auto-proceed to Phase 2. Review plan.md and run /pev-execute to continue."
      echo "[PEV] (Explicit override available: re-run with --force-auto flag.)"
      cat artifacts/plan.md
      exit 0
      ;;
  esac
fi
```

**executor 起動条件 (Step 4 へ進む条件)**:

- `permissionMode == "auto"` または `--force-auto` フラグ指定。 それ以外 (default / plan / 未設定 かつ flag なし) では **必ず exit 0** で停止する
- agent が「ユーザー意図」を理由に Step 4 へ進むことは禁止 (rules/pev-conventions.md §0 Gate respect)
- ユーザーが続行したい時は (a) `/pev-execute` を打つ、 (b) `permissionMode` を `auto` に変更、 (c) `--force-auto` フラグで explicit override (v1.6+)

### `--force-auto` の使い分け (v1.6+)

- **適切**: dog food / regression test、 CI 自動化、 信頼できる軽微タスク
- **不適切**: production-impacting な変更、 first-time skill 利用、 user が結果を見ずに進める手抜き
- 規約: planner 自身が override を判断するのは引き続き禁止。 ユーザー (or 上位 command) が **explicit に flag を立てる** ことが必須。 dog food log (v1.4+v1.5、 finding 4) で発覚した「prompt 自然言語での transgress」 を formal channel に置き換える。

### Step 4 — Phase 2 (Execute)

executor agent (model: sonnet, effort: high) を起動 (`--parallel` 時は最大3並列)。
コード変更 + `artifacts/execute.log` 記録。 **Gate L で branch checkout 済みなら、 実装は Linear 発行 branch 上で走る**。

### Step 5 — Gate B (Stop hookで自動)

Stop hook が `artifacts/execute.log` 存在を検出し、recap.log にPhase 2完了エントリ追記 + `/pev-verify` を促す。

### Step 6 — Phase 3 (Verify)

verifier agent。`--strict` 指定時は `pev-dual-review` skill 経由でReviewer A/B並列。
`artifacts/verify.json` 出力。

### Step 7 — Retry Gate

```bash
VERDICT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8')).verdict)" 2>/dev/null)
RETRY=$(cat artifacts/.retry_count 2>/dev/null || echo 0)
MAX=${PEV_MAX_RETRIES:-3}

# v1.8+ : --expect-fail フラグで retry loop を skip
# user が「このタスクは FAIL することを想定済 (dog food fixture / regression test)」を
# 明示するためのフォーマル channel。 retry に時間と token を費やさず即 escalate path に流す
EXPECT_FAIL=false
[[ "$*" == *"--expect-fail"* ]] && EXPECT_FAIL=true

# plan.md に `expectFail: true` メタが書かれている場合も同等扱い (planner 側で書き出す補助記法)
if [ "$EXPECT_FAIL" = "false" ] && grep -qE '^\s*expectFail:\s*true\s*$' artifacts/plan.md 2>/dev/null; then
  EXPECT_FAIL=true
  echo "[PEV] expectFail detected in plan.md (treating as --expect-fail)"
fi

case "$VERDICT" in
  PASS)
    if [ "$EXPECT_FAIL" = "true" ]; then
      echo "[PEV] Verdict: PASS but --expect-fail was set — UNEXPECTED PASS (fixture intent broke?)"
      echo "[$(date -u +%FT%TZ)] Unexpected PASS under --expect-fail (review fixture / spec drift)" >> artifacts/recap.log
    else
      echo "[PEV] Verdict: PASS — task complete"
      echo "[$(date -u +%FT%TZ)] Task complete (verdict: PASS, retries: $RETRY)" >> artifacts/recap.log
    fi
    ;;
  FAIL)
    if [ "$EXPECT_FAIL" = "true" ]; then
      echo "[PEV] Verdict: FAIL as expected (--expect-fail) — skipping retry, going to escalate path"
      echo "[$(date -u +%FT%TZ)] Expected FAIL recorded (retries skipped under --expect-fail)" >> artifacts/recap.log
      echo "[PEV] Run /pev-status --escalate"
    elif [ "$RETRY" -lt "$MAX" ]; then
      echo $((RETRY + 1)) > artifacts/.retry_count
      echo "[PEV] Verdict: FAIL — retry $((RETRY + 1))/$MAX, re-invoking planner"
      # → Step 2 へループ
    else
      echo "[PEV] Verdict: FAIL after $MAX retries — ESCALATING"
      echo "[PEV] Run /pev-status --escalate"
    fi
    ;;
esac
```

### `--expect-fail` の使い分け (v1.8+)

- **適切**: dog food fixture で意図的に retry-exhaust シナリオを exercise したいケース、 regression test で「FAIL が現状の正解」と確定しているケース、 negative test fixture
- **不適切**: 実装中の通常タスク (本来 retry で直る可能性を奪う)、 unknown error の調査
- 規約: `--expect-fail` は **意図的 FAIL の宣言** であり、 retry を skip することによる時間 / token 節約を目的にする。 PASS した場合は「想定外」として recap.log に warning を残す (fixture intent 崩壊 or spec drift の signal)
- 配置先 spec: `skills/pev-pipeline/SKILL.md` の Gate / Retry section
