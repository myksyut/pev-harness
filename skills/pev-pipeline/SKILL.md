---
name: pev-pipeline
description: PEV ((Triage →) Plan-Execute-Verify) パイプラインのメインフロー (v3.0+)。 Triage の plan_required / plan_skip 判定 + 各 phase 間の受け渡し規約、 .pev-artifacts/ ディレクトリ仕様、 Gate 判定ロジックを定義
---

# pev-pipeline (v3.0+)

PEV harnessの心臓部。 `/pev` コマンドが起動するメインフローを定義する。 v3.0 で **Phase 0 (Triage)** を新設、 Plan を on-demand 化。

## When to Use

- `/pev <task>` が呼ばれた時
- Phase間の遷移判断が必要な時
- Gate (A / B / Retry) の評価が必要な時

## How It Works

### Phase 遷移ルール (v3.0+)

```
START
  │
  ▼
[Phase 0: TRIAGE] (v3.0+ 新規)
  │   triage agentを起動 (model: sonnet, effort: low)
  │   入力: task description + cwd context
  │   出力: .pev-artifacts/triage.json (decision = plan_required | plan_skip)
  ▼
[Triage decision]
  │   plan_required → Phase 1 (Plan) へ
  │   plan_skip     → Phase 2 (Execute) へ直行 (Mode B、 plan-less)
  ▼
[Phase 1: PLAN] (= plan_required の場合のみ)
  │   planner agentを起動 (model: opus, effort: xhigh)
  │   入力: Goal/Constraints/AC + cwd context + triage.json
  │   出力: .pev-artifacts/plan.md (= 必要なら冒頭に「## 確認質問」)
  ▼
[Gate A] permissionMode判定 (= Plan が起動された場合のみ):
  │   "auto"    → 自動でPhase 2へ
  │   "default" → 停止、ユーザー承認待ち
  │   "plan"    → ここで終了
  ▼
[Phase 2: EXECUTE]
  │   executor agentを起動 (並列可)
  │   入力: .pev-artifacts/plan.md (Mode A) or task description + cwd context (Mode B)
  │   出力: code edits + .pev-artifacts/execute.log
  ▼
[Gate B] Stop hookが自動でPhase 3起動
  ▼
[Phase 3: VERIFY]
  │   verifier agentを起動 (model: sonnet, effort: xhigh)
  │   入力: git diff + plan.md (もしくは task description)
  │   出力: .pev-artifacts/verify.json
  ▼
[Retry Gate] (/goal 駆動) verify.verdict:
  │   /goal が「verifier (別 Task) 作の verdict PASS + 生 test 出力 exit 0」を condition に自走駆動
  │   PASS                       → goal 自動 clear → DONE
  │   FAIL && round < MAX        → re-plan → re-implement → verifier を別 Task 再 dispatch
  │   FAIL && round >= MAX       → goal hand back → 人間にescalate
  │   (--expect-fail / hooks 無効環境では /goal を起動せず verify 1 回で停止 = retry なし)
  ▼
DONE → pev-recap が recap.log に追記
```

### Model tiering (v4.2.0+、 v5.1.0 で orchestrator = Opus 5)

pipeline は 2 層の model 構成で動く。 **orchestrator (main session) = Opus 5** が phase 遷移と Gate 判定だけを担い、 token 量の重い phase 実体は委譲先 model が担う:

| Layer | Model | Effort | Input/Output 単価 ($/MTok) |
|---|---|---|---|
| Orchestrator (main session) | claude-opus-5 | high | 5 / 25 |
| Triage | sonnet (現行 Sonnet 5) | low | 3 / 15 |
| Plan | opus (現行 Opus 5) | xhigh | 5 / 25 |
| Execute (default: codex 委譲) | sonnet | high | 3 / 15 (codex 時は API 課金 0) |
| Verify | sonnet | xhigh | 3 / 15 |

コスト invariant: **orchestrator は artifacts の parse と dispatch のみ** (実装 file の Read / code 変更 / test 実行は phase agent へ)。 orchestrator token 比率の目安は task 全体の 15% 以下。 規約は `rules/pev-conventions.md` §7、 費用モデルと根拠は `experiments/v4.2-fable-orchestrator-cost.md` + `experiments/v5.1-opus5-retiering.md`。 Fable 5 (10 / 50) は settings.local.json での opt-in tier。

### Flag override (v3.0+)

- `--with-plan`: Triage を skip して必ず Plan を起動 (= v2.x 互換挙動)
- `--no-plan`: Triage を skip して必ず Plan-less Execute (= 最短 path)
- 指定なし: Triage の判定に従う (= default、 v3.0 推奨)

### task_id の発行

タスク開始時:

```bash
TASK_ID="$(date +%s)-$(openssl rand -hex 4)"
echo "$TASK_ID" > .pev-artifacts/.task_id
mkdir -p ~/.claude/pev/$TASK_ID
```

`.pev-artifacts/.task_id` は再開時に既存タスクを識別するのに使う。

### .pev-artifacts/ ディレクトリ規約

| ファイル | 書き手 | 用途 |
|---|---|---|
| `.task_id` | pipeline | タスクID保持 |
| `triage.json` | triage (v3.0+) | Phase 0 出力 (plan_required / plan_skip) |
| `plan.md` | planner | Phase 1 出力 (Plan 起動時のみ) |
| `execute.log` | executor | Phase 2 ログ |
| `verify.json` | verifier | Phase 3 結果 |
| `recap.log` | pev-recap skill | phase完了サマリの追記蓄積 |

すべて `.gitignore` 対象。タスク完了後に削除してOK (`/pev-status --clean`)。

### Gate A 判定の詳細

planner が `.pev-artifacts/plan.md` を出力した直後、現在の `permissionMode` を確認:

```bash
MODE=$(grep -o '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' .claude/settings.json | cut -d'"' -f4)
MODE=${MODE:-default}
```

- `auto`: 自動でexecutor起動、ユーザーに通知のみ
- `default`: 停止して `cat .pev-artifacts/plan.md` を表示、`/pev-execute` で続行
- `plan`: メッセージ表示してパイプライン終了

### Retry の条件と挙動 (/goal 駆動)

retry の自走駆動は Claude Code 公式 `/goal` primitive が担う (v4.1.0 で `/goal` 前提化、 legacy retry_count ループは撤去)。 **機構 (いつ次ターンを始め / いつ止めるか) は `/goal` に借り、 独立検証の dispatch と判断基準は pev が握る**。

`/goal` の condition は「pev verifier が **別 Task として** verify.json に verdict PASS を書き、 生 test 出力 exit 0 を会話に提示した」。 各 goal ターンで pipeline は:

1. (FAIL 再入時) planner を起動し plan.md を diff ベース更新
2. executor で実装 (Phase 2)
3. **verifier を必ず別 Task として dispatch** (Phase 3) — executor の self-report で verify.json を書くのは禁止
4. verifier が verify.json + 生 test 出力を会話に提示 → `/goal` evaluator が PASS/FAIL 判定

PASS → goal 自動 clear → DONE。 `PEV_MAX_RETRIES` (default 3) round を超えても FAIL なら goal が hand back し、 `/pev-status --escalate`。

**最重要規約**: `/goal` の evaluator は会話テキストしか読めず、 executor の自己申告と verifier の検証を区別できない。 よって「verifier を呼べ」 を condition に書くだけでは agent 分離は保証されない。 verifier を別 Task として起動する責務は **必ず pipeline (pev) が握る**。 `/goal` には継続/停止判定のみ委ねる。

**例外 (retry なし)**: `--expect-fail` / plan.md の `expectFail: true` / hooks 無効環境 (`disableAllHooks` / `allowManagedHooksOnly`) では `/goal` を起動せず verify 1 回で停止する (retry なし → escalate path)。 必須 Claude Code version は v2.1.156 で `/goal` の floor (v2.1.139) を上回るため version による degrade は発生しない。 詳細は `commands/pev.md` Step 7 の「例外」節。

### --expect-fail flag (v1.8+)

retry loop を skip して即 escalate path に流すための **明示宣言** flag。 dog food fixture / regression test 用途で、 「このタスクは FAIL を想定している」 ことを formal に表明する。

| Trigger | 挙動 |
|---|---|
| `/pev <task> --expect-fail` (CLI flag) | `verdict=FAIL` でも retry せず即 escalate、 `recap.log` に `Expected FAIL recorded` を記録 |
| `plan.md` 内 (planner 補助記法) | plan.md の任意行に `expectFail: true` を含めると CLI flag と同等扱い |
| `verdict=PASS` だった場合 | `Unexpected PASS under --expect-fail` を recap.log に記録 (fixture intent 崩壊 / spec drift の signal) |

**use case**:

- dog food fixture (例: TES-2 retry-exhaust シナリオ) で「FAIL が想定挙動」のタスクを exercise する時。 retry を回さないことで token と時間を節約
- regression test fixture で「FAIL が現状の正解」 を捕捉する時 (例: 直すべき bug がまだ残っている前提の test)
- negative test fixture

**規約**:

- `--expect-fail` は **意図的 FAIL の宣言**。 retry skip は副作用であり、 main intent は「想定 FAIL を明示する」こと
- 通常タスク (実装中で retry で直る可能性がある) には付けない。 retry の機会を奪う
- planner 自身が `expectFail: true` を勝手に書き出すのは禁止。 ユーザー (or 上位 command) が flag を立てた場合に限り planner が plan.md に echo する形が許容
- 関連 flag (`--force-auto`) との併用は許容: Gate A skip + retry skip で fully unattended な dog food / CI 自動化が可能

## Examples

ユーザー入力:
```
/pev "Add /healthz endpoint at src/server.ts"
```

pipelineが内部で展開する命令:
```
1. mkdir -p .pev-artifacts && echo "<task_id>" > .pev-artifacts/.task_id
2. invoke planner with: {goal, constraints, ac, files=hint}
3. on plan.md write → evaluate Gate A
4. if proceed: invoke executor
5. on Stop hook fire → invoke verifier
6. on verify.json write → evaluate Retry Gate
7. on done → invoke pev-recap
```

## 注意点

- pipelineはskillだが、実体的なロジックは各command (`/pev`, `/pev-plan` 等) の中にも分散する。skillはあくまで「規約のsource of truth」
- pipelineを「途中から再開」したい場合、`.pev-artifacts/.task_id` の存在で判定する
- 並列executor使用時、`recap.log` は executor全員が完了してから1回だけ追記する
