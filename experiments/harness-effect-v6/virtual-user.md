# 仮想ユーザー setting — v5 (申込キャンセル機能、 小出し型)

orchestrator (= 親 claude session) が agent の質問に応答する際の **唯一の参照** ファイル。 PM が「申込のキャンセル機能を追加してほしい」 と engineer に依頼している状況。 細部は質問されたら答える、 されなければ伝えない。

## 内心 spec (= 聞かれたら答える項目集)

| Q# | 項目 | 内心 A |
|---|---|---|
| Q1 | 用途 / なぜ追加? | 申込後すぐ取り消したい user の支援、 サポート負荷軽減 |
| Q2 | UI 配置 | success message の中に button、 既存 success の直下か同 row |
| Q3 | キャンセル対象 | 直前の 1 件のみ。 過去全件の一覧表示は scope 外 |
| Q4 | 確認 dialog | window.confirm で十分 |
| Q5 | キャンセル実行内容 | localStorage の最後の entry を pop + form reset + success hidden |
| Q6 | キャンセル後 message | 「申込をキャンセルしました」 / warning 色 (amber) |
| Q7 | button 文言 | 「キャンセルする」 |
| Q8 | 表示時間 / 消えるトリガ | 既存 success と同 pattern (form 編集開始で hidden) |
| Q9 | 認証 / 本人確認 | 不要 (= localStorage は本人 device のみ) |
| Q10 | 既存 entry が 0 件 | cancel button 自体 hidden |
| Q11 | 複数 entry の扱い | 直前 1 件のみ pop、 過去 entry は触らない |
| Q12 | キャンセル理由入力 | 不要 |
| Q13 | アクセシビリティ | 既存 pattern (aria-label, role=alert, aria-live=polite) |
| Q14 | test 範囲 | cancel 正常パス、 confirm cancel で no-op、 複数 entry で最新のみ pop、 既存 test 不変 |
| Q15 | デザイン (色 / animation) | 既存 success と同 pattern、 warning 色程度の差別化 |
| Q16 | TS / library 制約 | 既存規約 (TS 化禁止、 外部 library 禁止)、 既存 team-conventions に従う |

## 応答ルール (orchestrator が遵守)

1. **聞かれた項目だけ答える**。 関連項目を勝手に開示しない
2. 答えは **1-2 文の短いもの**
3. 該当しない項目は「特にこだわりなし、 既存と同じ pattern でお任せします」
4. agent が「複数選択肢を提示」 してきた場合は、 内心 spec に最も近いものを選ぶ
5. agent が **「進めて / OK / 続行」** を求めてきた場合は「進めて」 で OK
6. agent が **完成宣言** したら「ありがとう、 確認します」 で終了
7. virtual-user.md の途中追記は禁止 (= 実験中に「思いつき」 を増やさない)

## NG パターン

- spec.md / virtual-user.md に書かれていない要件を自発的に付け足す
- agent が質問してこない項目を勝手に開示する
- 複数項目を 1 度の応答で全部開示する
