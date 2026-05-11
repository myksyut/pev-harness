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

### Step 1: Task identification

```bash
mkdir -p artifacts
if [ ! -f artifacts/.task_id ]; then
  TASK_ID="$(date +%s)-$(openssl rand -hex 4 2>/dev/null || printf '%04x%04x' $RANDOM $RANDOM)"
  echo "$TASK_ID" > artifacts/.task_id
  echo "0" > artifacts/.retry_count
  mkdir -p ~/.claude/pev/$TASK_ID
fi
TASK_ID=$(cat artifacts/.task_id)
RETRY=$(cat artifacts/.retry_count 2>/dev/null || echo 0)
echo "[PEV] Plan phase for task $TASK_ID (retry $RETRY)"
```

### Step 2: Spec preparation

- 新規タスク: `pev-spec-template` でGoal/Constraints/AC を整形 (不足要素は質問返し)
- retry時: 既存 `artifacts/plan.md` + `artifacts/verify.json` + `git diff` を planner の入力に追加

### Step 3: Invoke planner

team-conventions.md (あれば) を読み込んで pre-pend。
planner agent (model: opus, effort: xhigh) を起動。

### Step 4: Output

planner が `artifacts/plan.md` を上書き。
pev-recap が `artifacts/recap.log` に Phase 1 完了エントリ追記。

```bash
echo "[PEV] Plan phase done. Review: cat artifacts/plan.md"
echo "[PEV] Continue with: /pev-execute"
```

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
