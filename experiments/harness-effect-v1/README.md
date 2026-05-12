# harness-effect-v1 — pev-harness 効果検証実験

**ハーネスありなしで同一 prompt から同じ Web アプリ (リアルタイム WebSocket chat) を作らせ、 4 軸で比較する** dog food driven な効果検証実験。

## 構成

```text
experiments/harness-effect-v1/
├── SPEC.md                  # 対象アプリの acceptance criteria (両者共通の到達目標)
├── prompt.txt               # 両者に渡す自然文 prompt (本文)
├── EVALUATION.md            # 採点 rubric (4 軸 各 10 点)
├── run.sh                   # 2 並行 background 実行 script
├── extract-metrics.sh       # stream-json から効率メトリクス抽出
├── logs/                    # stream-json / stderr / start_end timestamp (大半 .gitignore)
│   └── *.start_end.txt      # 経過時間のみ commit
├── scratch/                 # claude が実装した成果物 (.gitignore、 評価後に reports/ へ key file 抜粋)
└── reports/                 # 集計結果 (metrics.json / SUMMARY.md) — commit
```

## 実験設計

- **対照群 (no-harness)**: plugin なしの素の claude が `prompt.txt` を直接受ける
- **処理群 (with-harness)**: `--plugin-dir ~/pev-harness` 付きの claude が `/pev-harness:pev <prompt.txt 本文> --force-auto` を受ける
- 両者共通: `--permission-mode bypassPermissions --output-format stream-json --model claude-opus-4-7`
- 別々の scratch directory で完全隔離、 並行 background 実行

## 評価軸 (詳細は EVALUATION.md)

1. **コード品質** (構造 / 命名 / DRY) — 10
2. **テストカバレッジ + 動作確認の網羅性** — 10
3. **バグ / regression** — 10 (減点方式、 評価者の Playwright で第三者検証)
4. **効率** (turn 数 / wall-clock / token) — 10 (相対比較)

## 再現手順

```bash
cd /Users/miyakishota/pev-harness/experiments/harness-effect-v1

# 1. 並行実行 (timeout なし、 自然完走)
./run.sh

# 2. 効率メトリクス抽出
./extract-metrics.sh

# 3. 動作確認 (両 scratch dir で起動 → Playwright で評価)
cd scratch/no-harness && npm install && npm start &
# 別タブで
cd scratch/with-harness && npm install && npm start &
# Playwright で SPEC.md 軸3 のシナリオ S1-S5 を検証

# 4. 採点 → reports/SUMMARY.md 執筆
```

## 注意

- 両者の stream-json (`logs/*.stream.jsonl`) は数 MB 〜数十 MB の可能性、 `.gitignore` 対象。 commit するのは `logs/*.start_end.txt` と `reports/` のみ。
- `--force-auto` は pev-harness v1.6+ の機能。 古い harness では Gate A で停止する。
- 公平性のため、 prompt の本文は両者で完全同一。 wrap だけ違う。

## 結果

実行後、 `reports/SUMMARY.md` に集計レポート。 v1.7+ の改善 findings を抽出する。
