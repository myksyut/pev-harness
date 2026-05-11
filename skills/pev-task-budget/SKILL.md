---
name: pev-task-budget
description: Opus 4.7 の task_budget (beta) API を活用して phase 別にトークン予算を設定し、長時間 agentic loop の自己制御を有効化
---

# pev-task-budget

各phaseに「使ってよいtokenの目安」を渡す。モデル自身がカウントダウンを見て優先順位調整・グレースフル終了する。

## When to Use

- Plan/Execute/Verify の各phase起動時
- 長時間タスク (1時間以上推定) の前
- task_budget beta header をAPI呼び出しに付与する場面

## How It Works

### Phase別推奨予算

| Phase | 予算 (tokens) | 理由 |
|---|---|---|
| Plan | 50k | コードを広く読む、最低でも 20k 必要 |
| Execute (per executor) | 100k | 実装+周辺ファイル参照を含む |
| Verify | 30k | build/test 実行ログを取り込む |
| Dual Review (each reviewer) | 30k | 検証のみ |

合計目安: 1タスクあたり **180k〜400k tokens** (並列executor3個含む)

`PEV_TASK_BUDGET` 環境変数でグローバル上限を変更可能 (default: 100000)。

### task_budget API の使い方

Claude Code が内部的に Messages API を呼ぶ際、beta header を付与:

```python
response = client.beta.messages.create(
    model="claude-opus-4-7",
    max_tokens=128000,
    output_config={
        "effort": "xhigh",
        "task_budget": {"type": "tokens", "total": 50000},
    },
    messages=[...],
    betas=["task-budgets-2026-03-13"],
)
```

Claude Code側で `task_budget` を渡すには、現状はagentの description / promptで明示的に「target tokens: 50k」と伝えるのが現実的 (Claude Code v2.1.x でAPI passthroughが整備されるまでの暫定)。

### task_id 単位でのトラッキング

```
~/.claude/pev/{task_id}/budget.json
{
  "total": 100000,
  "phases": {
    "plan": {"target": 50000, "used": 47200},
    "execute": {"target": 100000, "used": 88500},
    "verify": {"target": 30000, "used": 12300}
  },
  "exhausted": false
}
```

### Budget exhausted 時の挙動

`used > target * 1.2` (20%超過) 時:

- 警告メッセージ表示
- pipeline はそのまま継続するが、recap.log に「budget超過」を記録
- 3回連続で budget 超過するタスクはpipelineが警告を上げる

## Examples

### Plan phase 起動時の呼び出し

```bash
echo "Target tokens for this plan phase: 50000" >> artifacts/.budget_hint
# planner agentを起動 (Read時にbudget_hintを参照)
```

planner agent はこの hint を読み、「50k以上のコードを読まないように」自己制約する。

### 長時間タスク用の予算拡張

```bash
PEV_TASK_BUDGET=500000 /pev "Refactor entire authentication system"
```

この場合、各phaseの予算が以下に拡張:
- Plan: 250k
- Execute: 500k (並列3並走で1.5M)
- Verify: 150k

## Limitations

- Claude Code v2.1.x ではAPI beta header の passthrough が完全ではない
- 現状は agent の prompt 内で予算ヒントを明示するのが信頼性高い
- 真の self-regulation は v0.3 で task_budget API直接利用版に置き換え予定

## 注意点

- 予算は **suggestion であり hard cap ではない** (Anthropic公式)
- 厳格な上限が必要な場合は `max_tokens` を使う (これはhard cap)
- 過度に厳しい予算は hallucination を増やすため、推奨値±20% を維持
