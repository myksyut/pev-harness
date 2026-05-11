# Error Patterns Catalog (v1.5+)

エラー推測 (Error Guessing) の知見を catalog 化。 `pev-test-design` skill が plan.md の Risks セクション生成時に参照する。 古典 QA 技法の 6 つ目「エラー推測」を体系化する目的。

team 固有のパターンは `team-conventions.md` の `## Error patterns (team-specific)` セクションに追加可能。

## 形式

各 pattern は以下の構造:

```markdown
### <pattern-name>

- **Symptom**: 何が起きるか
- **Trigger**: どんな AC / 機能で発生しやすいか
- **Mitigation**: 防ぐ実装パターン
- **Verification**: テストでの検証方法
```

## Catalog

### 二重送信 (double submission)

- **Symptom**: ユーザーがボタンを素早く 2 回クリック → 同じ request が 2 度送られる → DB に重複データ / 課金 2 回 / メール 2 通
- **Trigger**: form の submit ボタン、 課金フロー、 メール送信トリガー、 状態変更ボタン
- **Mitigation**:
  - クライアント: ボタンを clicked 直後に disable、 loading 表示中は再 click 不可
  - サーバ: idempotency-key で同一 request を冪等処理
- **Verification**: Playwright で `await page.click()` を `Promise.all` で 2 回同時実行、 DB / API call 数を確認

### 戻る操作後の再送信 (back-button resubmission)

- **Symptom**: form submit 後に画面遷移 → ユーザーが「戻る」 ボタン → form 状態が復元される → 再 submit で重複処理
- **Trigger**: POST form (購入 / 投稿 / 申込み)、 SPA の history.back()
- **Mitigation**:
  - サーバ: POST 後に 303 redirect (PRG パターン)
  - クライアント: submit 成功後に form を unmount or clear
- **Verification**: submit → 戻るボタン → 再 submit → サーバ側で重複拒否されるか

### API失敗時の中途半端な状態 (partial failure UI inconsistency)

- **Symptom**: UI 上は「保存しました」表示 / 実際の DB には反映されていない (or 逆)
- **Trigger**: 非同期 API call の後の状態表示、 楽観的 UI 更新、 エラー handling 不足
- **Mitigation**:
  - 楽観的 UI 更新後に確実な reconcile (response で確定 / rollback)
  - エラー時は明示的に「失敗しました」 表示 + retry option
- **Verification**: API を mock で意図的に 500 にして、 UI が誤誘導しないか check

### Timeout / Network 切断

- **Symptom**: 長い処理中に network 切断 → クライアントは loading 中のまま、 サーバは完了している (or 逆)
- **Trigger**: 大きな file upload、 長い計算 API、 オフライン環境
- **Mitigation**:
  - timeout 設定 (例: 30s)、 reconnect 再試行
  - poll / WebSocket / SSE で sync 復旧
- **Verification**: Playwright で network throttle / offline mode、 再接続時の再 sync

### 並行更新 (race condition)

- **Symptom**: 2 ユーザーが同じ resource を同時更新 → 最後の write が勝つ (lost update)
- **Trigger**: collaborative editing、 在庫管理、 残高更新
- **Mitigation**:
  - 楽観ロック (version number 比較)、 悲観ロック (DB lock)
  - last-write-wins / merge / conflict resolution UI
- **Verification**: 2 セッションで同時 update → 後者が version mismatch error を受けるか

### 巨大 payload / 限界値

- **Symptom**: 1MB 超のtext input、 10MB 超 file upload で server がメモリ不足 / timeout
- **Trigger**: textarea、 file upload、 list 一括 import
- **Mitigation**:
  - クライアント: input maxlength、 file size 制限
  - サーバ: request size limit、 streaming parse、 chunk upload
- **Verification**: 境界値 (limit - 1 / limit / limit + 1) で各挙動

### XSS (Cross-Site Scripting)

- **Symptom**: ユーザー入力に `<script>` 等を含む → 表示時に実行される
- **Trigger**: user-generated content、 search query、 comment、 profile
- **Mitigation**:
  - 出力時に escape (React は default で escape、 dangerouslySetInnerHTML は厳禁)
  - CSP (Content Security Policy)
- **Verification**: `<script>alert(1)</script>` を input して、 escape されるか確認

### SQL injection / NoSQL injection

- **Symptom**: query string や form input が SQL / NoSQL のメタ文字を含む → DB が誤動作
- **Trigger**: 動的 query 構築 (生 SQL、 string concat)
- **Mitigation**:
  - prepared statement / parameterized query
  - ORM の type safe API
- **Verification**: `' OR 1=1 --` 等を input してテーブル全行が返らないか

### 認可漏れ (authorization bypass)

- **Symptom**: ユーザー A が他人 (B) の resource にアクセスできる / 操作できる
- **Trigger**: URL 直接アクセス、 API endpoint、 ID 番号 enumeration
- **Mitigation**:
  - 全 endpoint で owner check / role check
  - resource ID は推測不能な UUID
- **Verification**: A セッションから B の resource URL を叩いて 403 / 404 が返るか

### Empty / Null edge case

- **Symptom**: empty array、 null user、 0 件の list で page が壊れる (e.g., `arr[0]` で undefined access)
- **Trigger**: 初期 state、 search で 0 件 hit、 deleted entity の参照
- **Mitigation**:
  - 空状態の UI を必ず実装 (empty state)
  - optional chaining / default value
- **Verification**: 空 array / null / 0 件 hit で UI が正しく表示されるか (chair の検出)

### 文字コード / 国際化

- **Symptom**: 絵文字 / 中国語 / アラビア語入力で文字化け / DB 保存エラー
- **Trigger**: text input、 file name、 ユーザー名
- **Mitigation**:
  - UTF-8 全 layer (DB / API / front)、 collation utf8mb4
  - RTL 言語の UI 対応
- **Verification**: 絵文字 (🎉) / 多言語 (你好) / RTL (مرحبا) を input

### Time zone / DST

- **Symptom**: 日付が 1 日ずれる、 DST 切替時に重複/欠落イベント
- **Trigger**: 予約日時、 過去日時表示、 cron job
- **Mitigation**:
  - サーバ: UTC で保存、 表示時に user の TZ で convert
  - DST 境界の test
- **Verification**: TZ Asia/Tokyo / UTC / America/Los_Angeles で同 timestamp が想定通り表示

## 適用ガイド

`pev-test-design` skill は AC を読んで、 該当しそうな pattern を 2-5 件抽出して plan.md の Risks セクションに追加する。 全 pattern を毎回適用するのは過剰なので、 trigger と AC の matching で選別:

| AC keyword | 適用 patterns |
|---|---|
| form / submit / 保存 | 二重送信、 戻る再送信、 API失敗時、 partial failure |
| upload / file / 添付 | 巨大 payload、 timeout、 文字コード |
| edit / 編集 / 更新 | 並行更新、 認可漏れ、 partial failure |
| search / 検索 / filter | Empty edge case、 SQL injection |
| comment / post / 投稿 | XSS、 二重送信、 文字コード |
| permission / role / 権限 | 認可漏れ |
| 日付 / date / 予約日 | Time zone / DST |

## 拡張

team 固有の error pattern は `team-conventions.md` の以下 section に追加:

```markdown
## Error patterns (team-specific)

### <pattern-name>
- Symptom: ...
- Trigger: ...
- Mitigation: ...
- Verification: ...
```

`pev-test-design` skill は team-conventions のこの section を読んで catalog に動的追加する。
