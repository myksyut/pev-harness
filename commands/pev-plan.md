---
description: Run only the Plan phase. Outputs artifacts/plan.md and stops
---

# /pev-plan

Plan phaseだけ実行する。設計レビュー、見積もり、初期検討で使う。

## Usage

```text
/pev-plan <task description>
/pev-plan                       # 既存 artifacts/plan.md を更新 (retry時)
```

## フロー

1. `pev-spec-template` でspec整形 (新規タスク時)
2. task_id 発行 or 既存を再利用
3. team-conventions.md (あれば) を pre-pend して planner agent を起動
4. `artifacts/plan.md` を書き出し
5. ユーザーに表示して終了 (Phase 2 に進まない)

## Phase 2 に進むには

```text
/pev-execute
```

## Use Cases

- アーキ判断だけしたい (実装しない)
- スプリント見積もり
- レビュー前の事前計画
- `permissionMode=plan` 相当の挙動を強制したい時

## Implementation note

task_id 管理 / retry時の入力統合 (`artifacts/verify.json` + `git diff` を planner に渡す) は v0.2 で実装。詳細は [Issue #1](https://github.com/myksyut/pev-harness/issues/1)。
