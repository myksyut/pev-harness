# 対象アプリ仕様 — リアルタイム WebSocket chat (minimal)

両者 (ハーネスあり / なし) が **同じ acceptance criteria** に向かうための共通仕様。 ファイル構成や依存ライブラリは指定しない (= 自由判断による差を観察する)。

## アプリ概要

ブラウザを開いた複数のユーザーが、 リアルタイムに同じ chat ルームでメッセージを送受信できる minimal Web アプリ。 ニックネーム以外の認証や永続化はなし。

## acceptance criteria

### A. 起動

- A1: 単一の `npm install && npm start` (または同等の単一コマンド) で server とブラウザ向け静的アセットが立ち上がる
- A2: ブラウザで `http://localhost:<port>` を開くと chat 画面が表示される

### B. ニックネーム

- B1: 初回アクセス時にニックネーム入力欄が出る (prompt() 等の modal でも、 inline form でも可)
- B2: 空文字や未入力での参加は許可しない
- B3: ニックネームはそのセッション中保持される (リロードで再入力でよい)

### C. メッセージ送受信 (broadcast)

- C1: ユーザーが入力した text メッセージは、 **接続中の全 client に realtime broadcast** される
- C2: メッセージは少なくとも `nickname` と `text` を含む形で表示される
- C3: 自分の送信メッセージも自分の画面に表示される
- C4: WebSocket (`ws://` または同等のリアルタイム双方向 transport) を使う (long polling や SSE は不可)

### D. 入退室通知 (任意 / nice-to-have)

- D1: 新しい client が join した時、 既存 client に「<nickname> が参加しました」相当の system message が表示される
- D2: client が disconnect した時、 同様に通知される

→ 実装しない場合も合格。 ただし採点 (rubric 参照) で加点対象。

### E. エラーハンドリング (最低限)

- E1: WebSocket が切断された時、 client 側で reconnect またはエラー表示を行う (沈黙して止まらない)
- E2: 空メッセージ送信は弾く (server 側 / client 側どちらでもよい)

## 非機能要件

- 言語: JavaScript / TypeScript (Node.js)。 server-side framework は自由 (`ws` 単体 / `socket.io` / `express + ws` 等)
- 永続化: なし (in-memory のみ)
- 認証: なし
- スタイル: 最低限読める CSS (装飾は不問)
- テスト: 単位/結合/E2E いずれの実装も自由 (rubric の B 軸 で評価)

## 動作確認方法 (両者共通)

```bash
npm install
npm start &
# 2 つのブラウザタブで http://localhost:<port> を開く
# タブ1: ニックネーム "alice" で入室、 "hello" 送信
# タブ2: ニックネーム "bob" で入室、 "hi alice" 送信
# 両タブで両メッセージが見えること
```

評価者 (= /pev-harness を develop している私) はこの手順 + 追加の境界 case (空メッセージ / 切断時 / 3 タブ同時) を Playwright で自動検証する。

## 制約

- 外部 API call なし (LLM 等で「処理」を委譲しない)
- DB なし、 file 書き込みなし (ログ除く)
- 1 ファイル化は不可 (server.js と index.html は最低限分離する)

以上を満たせば pass。 これ以上の機能 (room 分割 / DM / file upload 等) はscope 外、 加点もなし。
