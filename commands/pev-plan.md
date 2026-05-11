---
description: Run only the Plan phase. Outputs artifacts/plan.md and stops
---

# /pev-plan

Plan phaseだけ実行する。設計レビュー、見積もり、初期検討で使う。

## Usage

```
/pev-plan <task description>
/pev-plan                       # 既存 artifacts/plan.md を更新 (retry時)
```

## 実行手順

1. `pev-spec-template` でspec整形 (新規タスクの場合)
2. task_idが既にあれば再利用、なければ発行
3. planner agent を起動
   - team-conventions.md を pre-pend
   - 入力: spec + (retry時) 既存 plan.md + diff + verify.json
4. `artifacts/plan.md` を書き出し
5. ユーザーに表示して終了

## Phase 2 に進まない

このコマンドは Plan のみ。executor は起動しない。

続行するには:

```
/pev-execute                    # plan.md を読んで実装開始
```

## Use Cases

- アーキ判断だけしたい (実装しない)
- スプリント見積もり用
- レビュー前の事前計画
- `permissionMode=plan` 相当の挙動を強制したい時

## 出力例

```
[Phase 1: Plan done]
Output: artifacts/plan.md
Estimated budget: 47k tokens
Files to change: 2 (src/server.ts, tests/server.test.ts)

Next: /pev-execute to implement, or edit plan.md manually
```
