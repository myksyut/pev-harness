---
name: pev-pipeline
description: PEV (Plan-Execute-Verify) パイプラインのメインフロー。3 phase間の受け渡し規約、artifacts/ ディレクトリ仕様、Gate判定ロジックを定義
---

# pev-pipeline

PEV harnessの心臓部。`/pev` コマンドが起動するメインフローを定義する。

## When to Use

- `/pev <task>` が呼ばれた時
- Phase間の遷移判断が必要な時
- Gate (A / B / Retry) の評価が必要な時

## How It Works

### Phase 遷移ルール

```
START
  │
  ▼
[Phase 1: PLAN]
  │   planner agentを起動
  │   入力: Goal/Constraints/AC
  │   出力: artifacts/plan.md
  ▼
[Gate A] permissionMode判定:
  │   "auto"    → 自動でPhase 2へ
  │   "default" → 停止、ユーザー承認待ち
  │   "plan"    → ここで終了
  ▼
[Phase 2: EXECUTE]
  │   executor agentを起動 (並列可)
  │   入力: artifacts/plan.md
  │   出力: code edits + artifacts/execute.log
  ▼
[Gate B] Stop hookが自動でPhase 3起動
  ▼
[Phase 3: VERIFY]
  │   verifier agentを起動
  │   入力: git diff + plan.md
  │   出力: artifacts/verify.json
  ▼
[Retry Gate] verify.verdict:
  │   PASS                       → DONE
  │   FAIL && retry_count < 3    → Phase 1 へ戻る
  │   FAIL && retry_count >= 3   → 人間にescalate
  ▼
DONE → pev-recap が recap.log に追記
```

### task_id の発行

タスク開始時:

```bash
TASK_ID="$(date +%s)-$(openssl rand -hex 4)"
echo "$TASK_ID" > artifacts/.task_id
mkdir -p ~/.claude/pev/$TASK_ID
```

`artifacts/.task_id` は再開時に既存タスクを識別するのに使う。

### artifacts/ ディレクトリ規約

| ファイル | 書き手 | 用途 |
|---|---|---|
| `.task_id` | pipeline | タスクID保持 |
| `plan.md` | planner | Phase 1出力 |
| `execute.log` | executor | Phase 2ログ |
| `verify.json` | verifier | Phase 3結果 |
| `recap.log` | pev-recap skill | phase完了サマリの追記蓄積 |

すべて `.gitignore` 対象。タスク完了後に削除してOK (`/pev-status --clean`)。

### Gate A 判定の詳細

planner が `artifacts/plan.md` を出力した直後、現在の `permissionMode` を確認:

```bash
MODE=$(grep -o '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' .claude/settings.json | cut -d'"' -f4)
MODE=${MODE:-default}
```

- `auto`: 自動でexecutor起動、ユーザーに通知のみ
- `default`: 停止して `cat artifacts/plan.md` を表示、`/pev-execute` で続行
- `plan`: メッセージ表示してパイプライン終了

### Retry の条件と挙動

verify.json の `verdict == "FAIL"` かつ retry count < 3 の時:

1. `artifacts/retry_count` を increment
2. planner を起動 (入力に diff と verify.json を追加)
3. plan.md を**更新**（新規生成ではなく diff ベースで修正）
4. Phase 2 に進む

3回を超えた場合: `/pev-status --escalate` でメッセージ表示、自動継続しない。

## Examples

ユーザー入力:
```
/pev "Add /healthz endpoint at src/server.ts"
```

pipelineが内部で展開する命令:
```
1. mkdir -p artifacts && echo "<task_id>" > artifacts/.task_id
2. invoke planner with: {goal, constraints, ac, files=hint}
3. on plan.md write → evaluate Gate A
4. if proceed: invoke executor
5. on Stop hook fire → invoke verifier
6. on verify.json write → evaluate Retry Gate
7. on done → invoke pev-recap
```

## 注意点

- pipelineはskillだが、実体的なロジックは各command (`/pev`, `/pev-plan` 等) の中にも分散する。skillはあくまで「規約のsource of truth」
- pipelineを「途中から再開」したい場合、`artifacts/.task_id` の存在で判定する
- 並列executor使用時、`recap.log` は executor全員が完了してから1回だけ追記する
