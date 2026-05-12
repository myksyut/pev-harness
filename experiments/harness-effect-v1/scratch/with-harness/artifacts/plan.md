# Plan for: Realtime WebSocket chat app

## Goal

リアルタイム WebSocket チャットアプリを実装する。 複数のブラウザタブを開いている全ユーザーに、 入力したメッセージがリアルタイムで broadcast される。 入室時にニックネームを必須化し、 空メッセージは拒否、 切断時の client 側 reconnect / エラー表示を備える。 永続化なし (リロードで履歴消失して良い)。

採点シナリオ S1-S5 を確実に PASS させることが最終ゴール。

## Constraints

(input そのまま + team-conventions 由来。 project root に `team-conventions.md` は存在せず、 `~/.claude/pev/team-conventions.local.md` は空 stub のため、 input の制約のみが effective)

- 言語: Node.js + JavaScript (または TypeScript)。 framework 自由 (`ws` / `socket.io` / `express+ws` いずれも可)
- 認証なし、 DB なし、 外部 API なし
- 単一コマンドで起動できること (`npm install && npm start` 相当)
- server コードと client (HTML) は別ファイル
- 通信は WebSocket。 long polling / SSE は不可
- 永続化禁止 (memory 内 broadcast のみ)
- working directory `/Users/miyakishota/pev-harness/experiments/harness-effect-v1/scratch/with-harness/` はゼロから新規実装 (既存 `src/` 等なし)
- 出力 artifact: `artifacts/plan.md` のみ (Phase 1)

## Acceptance Criteria

### 採点シナリオ (S1-S5、 必達)

- [ ] **S1**: 2 つのブラウザタブで開き、 タブ A で nickname "alice" として "hello"、 タブ B で nickname "bob" として "hi alice" を送信すると、 両タブで両メッセージ (送信者 nickname + 本文) が見える
- [ ] **S2**: 空文字 (および空白のみ) のメッセージを送ろうとして、 broadcast されない (どの client にも届かない、 自分自身にも表示されない)
- [ ] **S3**: 3 タブ同時接続で、 1 タブから送信したメッセージが残り 2 タブ + 自分自身の計 3 タブ全てに表示される
- [ ] **S4**: 3 タブ接続のうち 1 タブを閉じた (= WebSocket 切断) 後、 残り 2 タブの間で broadcast が継続する
- [ ] **S5**: ニックネーム空欄 (または空白のみ) で入室を試みると、 入室が弾かれる (join が成立せずチャット画面に進めない or エラー表示)

### 機能的 AC (S1-S5 を支える詳細)

- [ ] **A1**: WebSocket protocol で通信する (long polling / SSE を使わない)
- [ ] **A2**: server / client コードは別ファイル (server: `server.js` 等、 client: `public/index.html` 等)
- [ ] **A3**: `npm install && npm start` (または `npm install` 後に `npm start` 単独) で server 起動、 localhost の static HTTP で client HTML が配信される
- [ ] **A4**: client が WebSocket に接続後、 nickname を server に送信して join。 join 成功でチャット送信可能になる
- [ ] **A5**: メッセージ broadcast 時、 送信者 nickname と本文が全 client (送信者自身含む) に届く
- [ ] **A6**: 自分が送ったメッセージも自分の画面に表示される (loopback or server echo)
- [ ] **A7**: 永続化しない (リロードで履歴消失。 server 側 in-memory も不要、 単純に未送信)
- [ ] **A8**: WebSocket 切断検知時、 client 側で reconnect 試行する **または** エラー表示する (沈黙して止まらない)

### Defensive / robustness AC

- [ ] **A9**: nickname が空文字 / 空白のみ / undefined の join request を server が reject する (S5 と対をなす server 側保証)
- [ ] **A10**: message 本文が空文字 / 空白のみ の send request を server が broadcast しない (S2 と対をなす server 側保証)
- [ ] **A11**: join 前 (= nickname 未確定) の状態で message を送ろうとしても broadcast されない
- [ ] **A12**: 不正な JSON / 想定外の message type を受け取った場合は silent ignore (server がクラッシュしない)
- [ ] **A13**: client 側 input でも空メッセージは送信ボタンを disable または送信を弾く (UX 改善、 server 側 A10 と二重防御)

### 任意 (やれば加点)

- [ ] **A14** (optional): 入退室時の system message broadcast (「alice が参加しました」 / 「alice が退室しました」)

## File-level changes

(working directory は空 scratch、 全て新規作成)

- [ ] `package.json` — name / version / `"type": "module"` (or CommonJS) / `scripts.start` / dependencies (`ws`、 任意で `express`)。 単一 `npm install && npm start` で起動できる構成
- [ ] `server.js` — WebSocket server + 静的 HTML 配信
  - HTTP server (built-in `http` or `express`) で `public/index.html` を配信
  - WebSocket server (`ws` library) を同 port に attach
  - message protocol: JSON `{type: "join", nickname}` / `{type: "message", text}` / (server → client) `{type: "message", nickname, text}` / `{type: "system", text}` (optional)
  - join handler: nickname validate (trim 後空でない) → reject or accept、 socket に nickname を bind
  - message handler: join 済み確認、 text validate (trim 後空でない) → 全 client に broadcast
  - close handler: 切断 socket を除外 (optional: system message broadcast)
- [ ] `public/index.html` — client (HTML + 埋め込み JS or 別 file)
  - 初期画面: nickname 入力 form (空欄では送信ボタン disable または submit reject)
  - チャット画面: メッセージ一覧表示エリア + 送信 input + 送信ボタン (空メッセージは送信 disable / reject)
  - WebSocket 接続管理: open / message / close / error handler
  - close 時: reconnect 試行 (exponential backoff も検討、 簡易には 3s 後 retry) または エラー表示
  - XSS 対策: 受信メッセージ表示時に `textContent` を使う (`innerHTML` 禁止)
- [ ] `README.md` — 起動方法 (`npm install && npm start`) + ブラウザでアクセスする URL (例: `http://localhost:8080`) + S1-S5 の動作確認手順
- [ ] `.gitignore` (任意) — `node_modules/` 除外

明示的に「触らない」file は本 scratch には存在しない (空 directory)。

## Implementation order

1. **package.json scaffolding** — `npm init -y` 相当を手書きで作成、 `ws` を dependency に追加、 `scripts.start` を `node server.js` に設定
2. **server.js (WebSocket + HTTP 配信)** — HTTP server で `public/index.html` を配信、 同 port に WebSocket server attach、 in-memory `clients` Set / socket→nickname Map を用意
3. **server message protocol 実装** — `join` (nickname validate → ack / reject)、 `message` (join 済み + text validate → broadcast)、 close handler (Set から remove)
4. **public/index.html — 入室フォーム** — nickname input + 「入室」 ボタン、 空欄では disable、 submit 時に WebSocket open + `{type:"join", nickname}` 送信
5. **public/index.html — チャット画面** — 入室成功後に画面切替、 メッセージ list 表示エリア、 send input、 空白 trim 後に送信、 受信 message を `textContent` で append
6. **client 切断 handling** — `ws.onclose` / `onerror` でエラー表示 + 3s 後 reconnect 試行 (再 join は同 nickname で再送信)
7. **README.md** — 起動方法 + S1-S5 の手動確認手順を箇条書き
8. **(optional) A14 system message** — join / leave 時に `{type:"system", text:"alice が参加しました"}` を broadcast、 client は別 style で表示
9. **手動 smoke (planner では実行しないが、 executor へ申し送り)** — 2-3 ブラウザタブで S1-S5 を手で確認

## Verification strategy

(Phase 3 verifier が実行する。 planner では proposal のみ)

- **Build**: なし (pure JS、 build step 不要)
- **Type check**: なし (plain JS 想定。 TS 採用時のみ `tsc --noEmit`)
- **Lint**: なし (project 内 lint 設定なし、 規約強制不要)
- **Tests**: 自動 unit test は scope 外 (S1-S5 は手動シナリオ)。 ただし executor が余裕あれば server validate logic (`isValidNickname` / `isValidMessage`) を切り出して単純 assert する node script を `tests/` に追加してもよい (optional)
- **Manual (採点シナリオ)**:
  - `npm install && npm start` → server 起動確認
  - ブラウザ 2 タブで http://localhost:<port> を開く → S1 (alice + bob で broadcast)
  - S2: 空メッセージ送信試行 → broadcast されないことを各タブで確認
  - S3: 3 タブで broadcast 確認
  - S4: 1 タブを閉じる → 残り 2 タブで継続 broadcast
  - S5: nickname 空欄で入室試行 → 弾かれることを確認
- **DevTools 確認** (optional verifier 強化): Network tab で WebSocket frame を見て、 空メッセージ送信時に server → client の broadcast frame が出ないことを確認

## Risks / Rollback

### 仕様起因

- **R1 (XSS)**: broadcast されるメッセージ本文に `<script>` や HTML tag を仕込まれた場合、 client が `innerHTML` で展開すると XSS が成立。 → **Mitigation**: client 側で `textContent` を使う (絶対 `innerHTML` を使わない)。 server 側 escape は本要件では不要だが防御層として有効
- **R2 (二重 join)**: 同一 socket で `{type:"join"}` を 2 回送信された場合、 nickname が上書きされて他 client から見て identity が変わる → **Mitigation**: server 側で「既に join 済みなら 2 回目は ignore」 と decide
- **R3 (巨大 payload)**: 数 MB の text を input されると server / client が高負荷 → **Mitigation**: server 側 message text の max length (例: 1000 文字) を設ける。 ws library の `maxPayload` option も併用可
- **R4 (不正 JSON / 想定外 type)**: client から `not-json-string` や `{type:"unknown"}` を送られて server crash → **Mitigation**: `try/catch` で JSON.parse 失敗を ignore、 type switch の default は no-op
- **R5 (reconnect ループ暴走)**: server 停止中に client が reconnect を即時 retry 連打すると CPU / network burn → **Mitigation**: 3s 以上の delay または exponential backoff、 max retry 上限を設ける
- **R6 (partial failure UI inconsistency)**: client send 後に server 側で reject されたとき client UI が「送信済み」 と誤誘導する可能性 → **Mitigation**: 自分の送信メッセージも server からの broadcast (echo) を受けて初めて表示する (loopback を server 側で行う)。 ack を待たず即時表示すると、 空メッセージを silent reject されたとき client に矛盾が生じる
- **R7 (state 不整合: 接続前 send)**: WebSocket が `OPEN` になる前に send すると例外。 → **Mitigation**: client は `ws.readyState === OPEN` を check してから send、 reconnect 中の send は queue or drop

### 運用 / 環境起因

- **R8 (port 衝突)**: 8080 等の default port が他 process で使用中 → **Mitigation**: README に port 変更方法を明記 (`PORT=9000 npm start`)
- **R9 (Node version)**: `ws` library は最近の Node を要求 → **Mitigation**: `package.json` の `engines.node` で 18+ を明示

### Rollback

scratch directory に全ファイル新規作成のため、 `rm -rf /Users/miyakishota/pev-harness/experiments/harness-effect-v1/scratch/with-harness/{package.json,server.js,public,README.md,node_modules,package-lock.json,.gitignore}` で初期状態に戻る。 artifacts/ は touch しない。

## Estimated task budget

- Phase 2 (executor) 実装規模: server.js ~100 行、 public/index.html ~150 行、 README + package.json で計 ~300 行
- Token 見積: executor で 30-40k tokens (file write 中心)、 verifier で 10-15k tokens (manual scenario verification の judge は手動なので token は手順記述のみ)
- 合計見積: **約 50k tokens 以内** に収まる見込み

## Test design analysis

### 適用した QA 技法

| 技法 | 適用箇所 | 派生観点 |
|---|---|---|
| **同値分割** | nickname / message 本文 | 空 / 空白のみ / 通常 / 長い / 特殊文字 (HTML tag) / 絵文字。 接続クライアント数: 0 / 1 / 2 / 3+ |
| **境界値** | trim 後の長さ | 0 文字 (= 空 / 空白のみ)、 1 文字 (最短)、 max length (例: 1000 文字、 1001 文字で reject) |
| **デシジョンテーブル** | (join 済み?) × (text 空?) × (WebSocket OPEN?) | join 前 send → reject (A11)、 join 後空 send → reject (A10/S2)、 join 後通常 send → broadcast (S1/S3)、 OPEN 前 send → client 側 drop (R7) |
| **状態遷移** | client の lifecycle | disconnected → connecting → joined (nickname OK) ⇄ chatting → disconnected → reconnecting → joined (再 join)。 禁止遷移: join 前 chatting、 disconnected 状態の send |
| **エラー推測** | `rules/error-patterns.md` catalog から抽出 | R1 (XSS / comment/post カテゴリ), R3 (巨大 payload), R4 (Empty / Null edge case), R5 (timeout / reconnect)。 該当しないが除外: SQL injection (DB なし)、 認可漏れ (認証なし)、 Time zone (日付扱わない) |
| **チェックリスト** | screen + e2e カテゴリ | 手動 S1-S5 を verifier 用に手順化、 DevTools Network frame 確認を optional 追加 |

### Defensive defaults (unspecified input)

- empty / whitespace-only nickname (join request) → **reject**、 reason: spec の機能要件「空文字 / 空白のみ は許可しない」 を server 側でも保証 (S5 と A9)
- empty / whitespace-only message body → **reject (broadcast しない)**、 reason: spec の機能要件「空メッセージは送信を弾く」 (S2 と A10)
- join 前の message send → **reject (silent return)**、 reason: spec で「入室時にニックネームを入力」 が前提条件、 join 未済の send は仕様の対象外 → defensive に拒否 (A11)
- 不正 JSON / 想定外 message type → **silent ignore**、 reason: spec の protocol 範囲外、 server crash 回避が優先 (A12)
- 同一 socket からの 2 回目以降の join → **ignore (1 回目の nickname を維持)**、 reason: spec で言及なし、 identity 上書きは混乱を招くため defensive に拒否
- max length 超 message body (例: 1001 文字) → **reject**、 reason: spec で上限明記なしだが巨大 payload は R3 防御として拒否を default に
- WebSocket OPEN 前の client 側 send → **drop (or queue)**、 reason: spec で接続前送信に言及なし、 例外回避のため defensive に drop (R7)

これらの defensive default は executor 実装時に server.js / public/index.html の両方で `if (条件) return;` または `if (条件) ws.send({type:"error",...})` パターンで明示的に書き出す。
