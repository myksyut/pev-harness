---
name: pev-task-budget
description: 各 phase に「使ってよいトークンの目安」を渡し、長時間 agentic loop の自己制御を有効化。Claude Code surface では公式 Task budgets API は非サポート (Anthropic 公式 B3 で明記)、 本 skill は **prompt-level hint のみ** の暫定運用。
---

# pev-task-budget

各 phase に「使ってよいトークンの目安」を渡す。モデル自身がカウントダウンを意識して優先順位調整やグレースフル終了する。

## ⚠️ 公式仕様との関係 (v2.1.2 追記)

**Anthropic 公式 [Task budgets docs (B3)](https://platform.claude.com/docs/en/build-with-claude/task-budgets)** より直接引用:

> Task budgets are not supported on Claude Code or Cowork surfaces at launch. Use task budgets directly via the Messages API on Claude Opus 4.7.

つまり Claude Code plugin 経由で `task-budgets-2026-03-13` beta header を passthrough する公式ルートは **現時点で存在しない**。 本 skill が実際に提供しているのは:

- ✅ **Layer 1**: agent prompt に「target task budget: Xk tokens」を hint として埋め込む (動作確認済、 LLM の self-rationing を期待)
- ❌ **Layer 2 (将来)**: `ANTHROPIC_BETA` 環境変数経由の beta header passthrough は Claude Code 側の対応待ち

「task budget が hard cap として効く」ことを期待した使い方は **できない**。 hint としての心理的圧力で agent が早めに切り上げる、 程度の効果が現実値。 厳密な上限が必要な場合は `max_tokens` または phase 分割で対処すること。

## When to Use

- Plan / Execute / Verify の各 phase 起動時 (自動)
- 長時間タスク (1時間以上推定) の前
- token コスト超過の懸念があるタスク

## Phase 別推奨予算

| Phase | 予算 (tokens) | 理由 |
|---|---|---|
| Plan | 50k | コードを広く読む、最低でも 20k 必要 |
| Execute (per executor) | 100k | 実装 + 周辺ファイル参照 |
| Verify | 30k | build/test 実行ログを取り込む |
| Dual Review (each reviewer) | 30k | 検証のみ |

合計目安: 1タスクあたり **180k〜400k tokens** (並列 executor 3個含む)。

`PEV_TASK_BUDGET` 環境変数でグローバル上限 (default: 100000)。

## 実装 (Claude Code v2.1.x 現実)

Claude Code v2.1.x では Messages API の `task-budgets-2026-03-13` beta header の plugin 側からの passthrough は完全対応していない。pev-harness の暫定運用は以下の2層:

### Layer 1: agent prompt 内の budget hint (現状動作確認済み)

planner / executor / verifier の prompt 内で `## Estimated task budget` セクションを必須にする。dog food で planner が "Estimated task budget: ~2k tokens" を出すことを確認済み。

各 agent はこの hint を自己制約として使う。例:

- "50k tokens 以上のコードを読まない"
- "100k tokens 超過の見込みなら scope を分割して回答"

### Layer 2: 環境変数による beta header 有効化 (ユーザー側設定)

Claude Code を起動する前に環境変数で有効化:

```bash
export ANTHROPIC_BETA="task-budgets-2026-03-13"
claude --plugin-dir ~/pev-harness
```

これで Claude Code 内部の API 呼び出しに beta header が付与される (Claude Code が対応していれば)。

## task_id 単位のトラッキング

`~/.claude/pev/{task_id}/budget.json` に各 phase の予算と消費量を記録:

```json
{
  "total": 100000,
  "phases": {
    "plan":    { "target": 50000,  "used": 47200 },
    "execute": { "target": 100000, "used": 88500 },
    "verify":  { "target": 30000,  "used": 12300 }
  },
  "exhausted": false
}
```

`used` は agent が自己申告で書き込む (現状の Claude Code は plugin に正確な token使用量を渡さない)。v2.0 で真の API 連携実現時に置換予定。

## Budget exhausted 時の挙動

`used > target * 1.2` (20%超過) 時:

- agent 内で警告を recap.log に追記
- pipeline はそのまま継続 (hard cap ではない)
- 3 回連続で予算超過するタスクは `/pev-status` が警告を上げる

## Examples

### planner agent prompt 内での自己制約

```text
Target task budget: 50000 tokens.

If you find yourself approaching this budget while reading
the codebase, stop reading and write the plan with what you
have. Mark sections as "needs follow-up" rather than continuing.
```

### 長時間タスク用の予算拡張

```bash
PEV_TASK_BUDGET=500000 /pev "Refactor entire authentication system"
```

各 phase の予算が以下に拡張:

- Plan: 250k
- Execute: 500k (並列3並走で 1.5M)
- Verify: 150k

## Limitations & roadmap

- **v0.x (現状)**: Layer 1 (agent prompt) のみ確実動作。ANTHROPIC_BETA は Claude Code側の対応次第
- **v2.0 (#9 別件)**: MCP server経由で外部 model も支える際、task_budget API beta header を確実に passthrough できる仕組みを整える

## 注意点

- 予算は **suggestion であり hard cap ではない** (Anthropic公式)
- 厳格な上限が必要な場合は `max_tokens` を使う (これは hard cap)
- 過度に厳しい予算は hallucination を増やすため、推奨値±20%を維持
- recap.log への自己申告 (used トークン数) は誤差±15%程度を想定
