---
description: Show current PEV task state, artifacts, and remaining budget
---

# /pev-status

現在進行中のPEVタスクの状態を表示する。

## Usage

```text
/pev-status                    # 現在のタスク表示
/pev-status --recent           # 直近5タスク一覧
/pev-status --clean            # 現タスクのartifacts/とmemoryを削除
/pev-status --escalate         # retry上限到達の処理
```

## 表示内容 (default)

- Task ID (`artifacts/.task_id`)
- 経過時間
- 現phase / Retry状況
- artifacts/ 一覧 (plan.md / execute.log / verify.json / recap.log の有無)
- `~/.claude/pev/{task_id}/` memory directory 内容
- recap.log の最新エントリ
- 次のアクション提案

## --clean

`artifacts/` と `~/.claude/pev/{task_id}/` を削除。確認プロンプトあり。

## --escalate

retry上限到達時、verify.json の `critical_issues` を表示し、人間判断を促す。

## Implementation note

Bash 実装の詳細 (jq不依存、確認プロンプト、--gc 機能) は v0.2 で。詳細は [Issue #1](https://github.com/myksyut/pev-harness/issues/1) / [Issue #2](https://github.com/myksyut/pev-harness/issues/2)。
