# 評価 rubric — 曖昧指示への対応 (harness-effect-v2)

中程度曖昧な依頼 (`prompt.txt`) に対する agent の振る舞いを 4 軸で採点。 各軸 10 点、 合計 40 点満点。

## 軸 1: Clarification 行動 / 質問返しの質 — 10

| 観点 | 配点 | 評価方法 |
|---|---:|---|
| 質問返しの有無 (= 推測で進まないか) | 3 | 1 turn 目の response が agent assumption ベースの実装に直行していない |
| 質問項目の重要度カバレッジ (Q1-Q11 の必須機能領域) | 4 | virtual-user.md の Q1-Q11 のうち、 agent が初期に聞いた項目数 / 11 |
| 質問の具体性 (Yes/No or 選択式が示されているか、 端的か) | 2 | 「DB? localStorage? IndexedDB? いずれが希望ですか」 のような選択提示があると満点 |
| 質問の冗長性 (overkill な深堀り回避) | 1 | 30 項目以上の長文質問は減点、 端的な 5-15 項目が理想 |

## 軸 2: 推測品質 (質問せず進んだ部分の妥当性) — 10

agent が **質問せず推測した項目** に対し、 推測内容が virtual-user.md 想定要件と一致するか。

| 観点 | 配点 | 評価方法 |
|---|---:|---|
| 「凡庸な平均」への収束 (= TODO アプリの common pattern を踏襲) | 4 | localStorage / 単一リスト / 追加・完了・削除 等の common minimal feature が出ているか |
| 仮想ユーザー想定要件との一致率 | 3 | virtual-user.md の Q1-Q17 のうち、 推測が虚しさ A と一致した項目数 / 17 |
| 不要機能の "勝手な拡張" 回避 | 2 | 同期 / 認証 / 通知 / マルチデバイス / dark mode toggle 等の **要らない機能** を勝手に実装していないか (実装あれば -1 / 各、 最大 -2) |
| 推測判断の明示 (assumptions log がある) | 1 | コードコメント / README / chat の冒頭で「以下を仮定しました」と明示しているか |

## 軸 3: 成果物の品質 — 10

| 観点 | 配点 | 評価方法 |
|---|---:|---|
| ブラウザで起動して動く (1 click / 1 cmd で開ける) | 3 | 単一 HTML を開く / `npm start` で動く |
| CRUD 機能 (追加 / 完了 / 削除) が全部動く | 3 | 手動 / programmatic で確認 |
| localStorage 永続化が動く (リロードでデータ残る) | 2 | 手動確認 |
| UI 最低限見やすい (タスク一覧が表示される、 ボタンが分かる) | 1 | 目視 |
| README / 起動方法明記 | 1 | 目視 |

## 軸 4: 効率 — 10

| 観点 | 配点 | 評価方法 |
|---|---:|---|
| 完成までの assistant turn 数 (少ないほど高得点、 相対比較) | 4 | stream-json から count |
| wall-clock time (短いほど高得点、 相対比較) | 3 | start/end timestamp |
| token 消費 (少ないほど高得点、 相対比較) | 3 | stream-json の usage 集計 |

> 注: ハーネスありが質問返しで turn 数増えるのは想定内。 鍵は「質問返しの投資が手戻り削減で回収されるか」「推測品質の差が token を上回って良い成果物を出すか」 のトレードオフ。

## 報告書 format

`reports/SUMMARY.md` に以下を記録:

```markdown
# 実験結果 (date)

## メトリクス table

| 軸 | no-harness | with-harness |
|---|---:|---:|
| 1. Clarification 行動 | X/10 | Y/10 |
| 2. 推測品質 | X/10 | Y/10 |
| 3. 成果物品質 | X/10 | Y/10 |
| 4. 効率 | X/10 | Y/10 |
| **合計** | XX/40 | YY/40 |

## Clarification log (軸 1 / 2 の根拠)

### no-harness
- 質問返し: あり / なし
- 質問項目: (列挙)
- 推測項目: (列挙)
- 推測の虚しさ A 一致率: N/17

### with-harness
- (同様)

## findings (v2.2+ への反映候補)
- F1: ...
```

## 補足: 公平性

- orchestrator は **両者に同じ応答ルール** で対応 (virtual-user.md §応答ルール)
- agent が同じ項目を聞いたら同じ答えを返す
- 「お任せ」と返した項目に対し agent が異なる選択をしたら、 それは推測品質の差として軸 2 で評価
