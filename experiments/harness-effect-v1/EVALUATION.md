# 評価 rubric — ハーネスありなし比較

両者の成果物に対して、 以下の 4 軸で採点する。 各軸 0-10 点、 合計 40 点満点。 採点者は pev-harness develop session の Claude (= 私) + user による定性確認。

## 軸 1: コード品質 (構造 / 命名 / DRY) — 10 点

| 観点 | 配点 | 評価方法 |
|---|---|---|
| ファイル分割の妥当性 (server / client / 設定 が混在していない) | 3 | 目視 |
| 関数 / 変数命名 (handler / event の意図が読める) | 3 | 目視 |
| DRY: broadcast / send 等の重複ロジックが integrate されている | 2 | 目視 |
| 不要 import / dead code がない | 1 | 目視 + `eslint --no-eslintrc --rule 'no-unused-vars: error'` |
| README が読める | 1 | 目視 |

## 軸 2: テストカバレッジ + 動作確認の網羅性 — 10 点

| 観点 | 配点 | 評価方法 |
|---|---|---|
| 単体 / E2E テストが存在する | 2 | `find . -name '*.test.*' -o -name '*.spec.*'` |
| broadcast の正常系 (2 client 間でメッセージが届く) を test 化 | 3 | テスト読み + 実行 |
| 空メッセージ / 切断 / 複数 client 等の境界 case が test 化 | 3 | テスト読み |
| README に動作確認手順がある | 1 | 目視 |
| test command で全 pass する | 1 | 実行 |

## 軸 3: バグ / regression — 10 点 (減点方式、 10 から差し引く)

評価者が以下のシナリオを Playwright で第三者検証する:

| シナリオ | 失敗時の減点 |
|---|---|
| シナリオ S1: 2 タブで broadcast (alice/bob 双方向) | -3 |
| シナリオ S2: 空文字メッセージを送ろうとして失敗する | -1 |
| シナリオ S3: 3 タブ同時接続で全員に broadcast | -2 |
| シナリオ S4: 1 タブ切断後、 残った 2 タブで broadcast 継続 | -2 |
| シナリオ S5: ニックネーム空欄で入室を試みて弾かれる | -1 |
| その他 (console エラー / 起動失敗 / 想定外 crash) | -1 ずつ |

## 軸 4: 効率 (ターン数 / 時間 / token) — 10 点

| 観点 | 配点 | 評価方法 |
|---|---|---|
| 完成までの assistant turn 数 (少ないほど高得点) | 4 | stream-json から count、 相対比較 |
| wall-clock time (短いほど高得点) | 3 | start/end timestamp、 相対比較 |
| token 消費 (少ないほど高得点) | 3 | stream-json の usage 集計、 相対比較 |

> 注: 効率軸は **絶対値ではなく相対比較**。 ハーネスありが多くの turn / token を消費するのは想定内 (Plan/Verify オーバーヘッド)。 鍵は「その投資がコード品質 / バグ低減を上回るか」。

## 報告書 format

`reports/SUMMARY.md` に以下を記録:

```markdown
# 実験結果 — v1 (date: 2026-MM-DD)

## 環境
- claude version: ...
- pev-harness version: vX.Y.Z
- model: claude-opus-4-7

## メトリクス table

| 軸 | ハーネスなし | ハーネスあり |
|---|---|---|
| 1. コード品質 | X/10 | Y/10 |
| 2. テストカバレッジ | X/10 | Y/10 |
| 3. バグ regression | X/10 | Y/10 |
| 4. 効率 | X/10 | Y/10 |
| **合計** | XX/40 | YY/40 |

## 軸別 詳細所見

### 軸1
...

### 軸2
...

## 結論
ハーネスの effect は [+|-] N 点、 主因は ...

## findings (次 release に向けて)
- F1: ...
- F2: ...
```

## 補足: 評価の公平性確保

- 両者を **同一の Playwright シナリオ** で計測する (評価者が手動で走らせる)
- token / turn は stream-json の machine-readable から抽出、 主観なし
- コード品質と網羅性は主観入るので、 観点ごとに 0/1/2/3 のラダーを記述してブレを最小化
