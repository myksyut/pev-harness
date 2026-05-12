# WS Chat

Node.js + `ws` + `express` で動く、 永続化なしのリアルタイム broadcast チャット。

## 起動

```bash
npm install
npm start
```

デフォルトで `http://localhost:3000` で listen する。 ポートを変えたい場合は `PORT=4000 npm start`。

ブラウザで `http://localhost:3000` を開くと、 まずニックネーム入力画面が出る。 入室するとチャット画面に切り替わる。

## アーキテクチャ

- `server.js` — Express で `public/` を static 配信、 同じ HTTP server に `ws.WebSocketServer` を attach
- `public/index.html` — ニックネーム gate → チャット UI。 自動再接続 (最大 5 回, exponential backoff 1s→8s)。
- 送受信は JSON。 protocol:
  - client→server: `{type:"join", nickname}` / `{type:"message", text}`
  - server→client: `{type:"joined", nickname}` / `{type:"message", nickname, text, ts}` / `{type:"system", text, ts}` / `{type:"error", reason}`
- broadcast は join 済 client 全員 (自分含む) に配る。

## バリデーション

| 対象 | server | client |
|---|---|---|
| 空ニックネーム | reject + 接続 close | submit 阻止 + エラー表示 |
| 空メッセージ (空白のみ含む) | broadcast せず error 返却 | 送信前に弾く |
| 文字数上限 | nickname 32 / message 2000 で truncate | input maxlength で制限 |

## 動作確認シナリオ

| ID | 手順 | 期待結果 |
|---|---|---|
| **S1** | タブ A で `alice`、 タブ B で `bob` として入室。 A から `hello` 送信、 B から `hi alice` 送信。 | 両タブで両メッセージが見える。 自分のメッセージは右寄せ (青背景)。 |
| **S2** | 入室後、 空欄のまま送信ボタン or 空白だけ入れて送信。 | 何も broadcast されない。 他タブに何も届かない。 |
| **S3** | 3 タブを同時に開いて全員入室。 どれか 1 つから送信。 | 残り 2 タブ + 送信元に表示される (合計 3 タブ全部)。 |
| **S4** | 3 タブのうち 1 つを閉じる。 残った 2 タブで送受信。 | 残り 2 タブで broadcast が継続。 退室 system message が他タブに表示される (任意機能)。 |
| **S5** | ニックネーム入力欄を空 or 空白だけにして「入室」を押す。 | 入室不可、 `ニックネームを入力してください` が表示される。 |

### 手動再接続テスト (任意)

1. 入室済の状態で `Ctrl+C` で server を一旦止める。
2. ヘッダー右の status が `reconnecting…` → 1s 後リトライ → server が落ちたままなら delay が伸びていく。
3. 5 回失敗で `再接続失敗。 リロードしてください` と赤いステータスに変わる。
4. server を再起動して 5 回以内なら自動復帰、 超えていたらリロードで再入室。

## 制約と割り切り

- 永続化なし: server 再起動で history は失う。
- 認証なし: 同じニックネームを複数タブで重複利用しても弾かない (要件外)。
- DM・チャネル分けなし: 単一のグローバル broadcast room。
