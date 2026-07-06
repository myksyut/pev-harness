---
description: Run only the Execute phase. Reads .pev-artifacts/plan.md and implements changes
---

# /pev-execute (v3.0+ で 2 mode 対応)

既存の `.pev-artifacts/plan.md` を読んで実装する。 v3.0+ では plan.md がない場合 (= Triage が plan_skip 判定済) に **Mode B (plan-less)** で task description + cwd context から直接実装することも可能。

## Usage

```text
/pev-execute                       # Mode A: plan.md ベース (= 従来挙動)
/pev-execute --parallel            # 独立ファイル変更を並列実行 (最大3)
/pev-execute --plan-less           # Mode B (v3.0+): plan.md なしで task description + cwd context から実装
/pev-execute --executor-mode=codex # 実 file 編集を OpenAI Codex CLI に委譲 (v3.5.0+)
```

## 前提条件

### Mode A (plan ベース、 v2.x 互換、 v3.0+ default)

- `.pev-artifacts/plan.md` が存在する
- plan.md に `## File-level changes` セクションがある

### Mode B (plan-less、 v3.0+ 新規)

- `.pev-artifacts/triage.json` が存在し、 `decision = "plan_skip"`
- もしくは `--plan-less` flag 指定
- task description (= `/pev` 経由なら user prompt、 `/pev-execute` 直接なら argument) を入力

両 mode 不在ならエラー停止、 `/pev <task>` で Triage → 適切 path を促す

## フロー

1. plan.md を読んで File-level changes リストを抽出
2. `--parallel` 指定時、独立ファイル群を識別
3. executor agent (model: sonnet, effort: high) を起動
   - 並列モード: 同一メッセージ内で複数 Agent tool calls (最大 `PEV_PARALLEL_EXECUTOR_MAX`、default 3)
   - 順次モード: 1 executor が順に変更
   - codex mode (`PEV_EXECUTOR_MODE=codex` / `--executor-mode=codex`、 v3.5.0+): executor agent が wrapper となり、 `pev-external-executor` skill 経由で codex に実 file 編集を委譲。 codex 未 setup なら Claude native に degrade
4. 各executor は `~/.claude/pev/{task_id}/executor-{N}.md` に memory 書き込み
5. 全完了後、`.pev-artifacts/execute.log` に変更ファイル一覧 + 提案コミットメッセージ
6. Stop hook が `/pev-verify` を促す

## Mode B Self-Clarify 受領 (v3.2.0+)

Mode B (= plan-less) 実装中に executor が `.pev-artifacts/clarification.md` を書いて exit した場合、 main session は:

1. `.pev-artifacts/clarification.md` の存在を check (= executor 完了後の post-execute step)
2. ファイルがあれば user に内容を提示 (= reasoning + 質問 + default + 影響範囲)
3. Stop hook の Verify auto-trigger を **skip** (= clarification 中は Verify しない)
4. user 応答後の resume path を提示:

```bash
# Pattern A: user が質問に回答
/pev-harness:pev <answers>
# → 新 task として走る、 clarification.md の context を継承

# Pattern B: default で進める (= clarification.md の「default 案」 採用)
/pev-execute --use-defaults
# → executor を Mode B で再 invoke、 default を採用して実装続行

# Pattern C: clarification を discard
/pev-status --clean
# → task 自体を破棄
```

**意図**: Mode B の Self-Clarify Protocol (= agents/executor.md L+) を main session 側で受領、 user が判断する formal channel を提供。 task_infeasible (v3.0.5) と同じ「agent + commands 統合」 設計教訓 (= F_v10_1) を適用。

## Notes

- このコマンドは git commit を打たない (人間が境界を決める)
- `--strict` フラグはここでは無視 (Verify phase のみで効く)
- `--use-defaults` flag (v3.2.0+): Mode B clarification.md の「default 案」 を採用して再 invoke
- `--executor-mode=codex|claude` flag (v3.5.0+): 実装担当を切り替える。 優先順は flag > `PEV_EXECUTOR_MODE` env > settings default (`codex`)。 詳細は `skills/pev-external-executor/SKILL.md`

## Implementation note

並列executor の依存解析 / Stop hook auto-trigger の確実性 は v0.2 で実装。詳細は [Issue #1](https://github.com/myksyut/pev-harness/issues/1)。
