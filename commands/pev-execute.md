---
description: Run only the Execute phase. Reads artifacts/plan.md and implements changes
---

# /pev-execute (v3.0+ で 2 mode 対応)

既存の `artifacts/plan.md` を読んで実装する。 v3.0+ では plan.md がない場合 (= Triage が plan_skip 判定済) に **Mode B (plan-less)** で task description + cwd context から直接実装することも可能。

## Usage

```text
/pev-execute                 # Mode A: plan.md ベース (= 従来挙動)
/pev-execute --parallel      # 独立ファイル変更を並列実行 (最大3)
/pev-execute --plan-less     # Mode B (v3.0+): plan.md なしで task description + cwd context から実装
```

## 前提条件

### Mode A (plan ベース、 v2.x 互換、 v3.0+ default)

- `artifacts/plan.md` が存在する
- plan.md に `## File-level changes` セクションがある

### Mode B (plan-less、 v3.0+ 新規)

- `artifacts/triage.json` が存在し、 `decision = "plan_skip"`
- もしくは `--plan-less` flag 指定
- task description (= `/pev` 経由なら user prompt、 `/pev-execute` 直接なら argument) を入力

両 mode 不在ならエラー停止、 `/pev <task>` で Triage → 適切 path を促す

## フロー

1. plan.md を読んで File-level changes リストを抽出
2. `--parallel` 指定時、独立ファイル群を識別
3. executor agent (model: sonnet, effort: high) を起動
   - 並列モード: 同一メッセージ内で複数 Agent tool calls (最大 `PEV_PARALLEL_EXECUTOR_MAX`、default 3)
   - 順次モード: 1 executor が順に変更
4. 各executor は `~/.claude/pev/{task_id}/executor-{N}.md` に memory 書き込み
5. 全完了後、`artifacts/execute.log` に変更ファイル一覧 + 提案コミットメッセージ
6. Stop hook が `/pev-verify` を促す

## Notes

- このコマンドは git commit を打たない (人間が境界を決める)
- `--strict` フラグはここでは無視 (Verify phase のみで効く)

## Implementation note

並列executor の依存解析 / Stop hook auto-trigger の確実性 は v0.2 で実装。詳細は [Issue #1](https://github.com/myksyut/pev-harness/issues/1)。
