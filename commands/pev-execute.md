---
description: Run only the Execute phase. Reads artifacts/plan.md and implements changes
---

# /pev-execute

既存の `artifacts/plan.md` を読んで実装する。

## Usage

```text
/pev-execute
/pev-execute --parallel      # 独立ファイル変更を並列実行 (最大3)
```

## 前提条件

- `artifacts/plan.md` が存在する
- plan.md に `## File-level changes` セクションがある
- 不在ならエラー停止し、`/pev-plan` を促す

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
