# Plan for: ブラウザで動くシンプルな TODO アプリ (vanilla HTML/CSS/JS + localStorage)

## Goal

ローカルファイルとして開ける、ブラウザで動くシンプルな TODO アプリを実装する。`open index.html` だけで起動でき、TODO の追加 / 完了トグル / 削除 / localStorage 永続化ができる、最小構成の単一ファイル SPA。

## Constraints

入力 spec から:

- 純 HTML + CSS + vanilla JavaScript のみ (Node.js / npm / framework 不可)
- 単一ディレクトリ (cwd) に `index.html` を置く、`open index.html` だけで動く
- 永続化は localStorage のみ (外部サービス / API 呼び出し禁止)
- ファイル数は最小限 — 理想は `index.html` 1 枚に CSS と JS をインライン
- モダンブラウザ (Chrome / Safari 最新) のみ対応、IE 互換不要

team-conventions から:

- `~/.claude/pev/team-conventions.local.md` は実質空 (Forbidden 項目なし)
- project ローカル `team-conventions.md` は存在しない
- → 適用すべき project 規約はなし、 上記 spec の Constraints のみが拘束条件

追加の暗黙制約 (Phase 1 で明示化):

- ビルドステップ禁止 (TypeScript / Babel / バンドラなし)
- 外部 CDN への依存禁止 (オフライン / file:// で開ける状態を保つため)
- `<script src="...">` の外部参照禁止、 inline `<script>` のみ
- ES Modules の `import` は file:// 経由で動作しないブラウザがある → 単一 `<script>` ブロック内で完結させる

## Acceptance Criteria

入力 spec の AC をチェックリストに転写:

- [ ] AC1: `index.html` を開くと TODO 入力フォーム (text input + 追加ボタン) と TODO 一覧が表示される
- [ ] AC2: テキスト入力 → Enter キーまたは「追加」ボタン押下で、その TODO が一覧に追加される
- [ ] AC3: 各 TODO 行にチェックボックスがあり、トグルすると完了/未完了が切り替わる。完了済は視覚的に区別される (取り消し線 + 文字色グレー)
- [ ] AC4: 各 TODO 行に削除ボタン (✕ 等) があり、押すとその TODO だけが一覧から消える
- [ ] AC5: ページをリロードしても TODO リストが保持される (localStorage に保存・復元)
- [ ] AC6: 空文字または空白のみでの追加は無視される (バリデーション)
- [ ] AC7: レイアウトは中央寄せでモバイル幅 (375px) でも崩れない、基本的なスタイリングが施されている

追加で derived な AC (test design self-check の結果、 §Test design analysis 参照):

- [ ] AC8: ユーザー入力に HTML 特殊文字 (`<script>alert(1)</script>` 等) を含めても escape されて実行されない (XSS 対策)
- [ ] AC9: TODO 0 件の初期状態でも UI が崩れない (empty state、 一覧 `<ul>` が空でも form は表示される)
- [ ] AC10: 絵文字 / 多言語 (日本語 / 中国語) を含む TODO テキストが正しく保存・表示される (UTF-8)
- [ ] AC11: localStorage の値が壊れている / parse error の場合、 アプリは crash せず空 list で起動する (defensive)

## File-level changes

- [ ] `index.html` (新規作成) — HTML5 boilerplate + `<style>` (CSS インライン) + `<script>` (JS インライン) を 1 枚に統合。 単一ファイル構成
- [ ] その他のファイル — 作成しない (`open index.html` だけで動く制約を守る)

## Implementation order

1. **HTML 骨格**: `<!DOCTYPE html>` + `<meta charset="UTF-8">` + `<meta name="viewport" content="width=device-width, initial-scale=1">` + `<title>TODO</title>`。 body に `<main class="app">` を 1 つ置き、 中に `<h1>` / `<form id="todo-form">` (text input + 追加ボタン) / `<ul id="todo-list">` を配置
2. **CSS インライン (`<style>` in `<head>`)**:
   - `body { font-family: system-ui, sans-serif; }` で OS native font (外部 font 依存禁止のため)
   - `.app { max-width: 480px; margin: 0 auto; padding: 16px; }` で中央寄せ + モバイル対応 (375px 幅で崩れない)
   - form は `display: flex; gap: 8px;` で input と button を横並び、 input は `flex: 1`
   - list の各 row は `display: flex; align-items: center; gap: 8px;` (checkbox + text + 削除ボタン)
   - completed 状態は `.completed { text-decoration: line-through; color: #999; }` クラスで表現
   - 削除ボタンは `border: none; background: transparent;` で軽く、 hover 時に色付け程度
3. **JS インライン (`<script>` を `</body>` 直前)**:
   - state は in-memory な配列 `let todos = [];` (各要素は `{ id: string, text: string, done: boolean }`)
   - `STORAGE_KEY = 'todos.v1';` を const で定義 (将来のスキーマ変更に備えて version 付与)
   - 関数を以下の責務で分割:
     - `loadFromStorage()`: localStorage から読む。 parse error / 不正形式は catch して空配列にフォールバック (AC11 defensive)
     - `saveToStorage()`: `JSON.stringify(todos)` で書き込み
     - `render()`: `#todo-list` 配下を一度クリアして配列から再描画。 各 TODO 行は `document.createElement` + `element.textContent` で構築 (innerHTML 禁止 — XSS 対策 AC8)
     - `addTodo(text)`: trim 後に空なら return (AC6)、 そうでなければ `{ id: crypto.randomUUID(), text, done: false }` を unshift → save → render
     - `toggleTodo(id)` / `removeTodo(id)`: 配列を更新 → save → render
   - event 配線:
     - form の `submit` イベントで `preventDefault` → input 値で `addTodo` → input を空に
     - list 側は **event delegation** で `#todo-list` に 1 つ listener。 `target.dataset.action` で `toggle` / `remove` を分岐 (各 row に listener を貼らず、 row 再生成しても listener 漏れがない)
   - 初期化: `loadFromStorage()` → `render()`
4. **手動確認**: `open index.html` で起動して AC1-AC11 を一通り叩く (executor は Phase 2、 verifier は Phase 3 で詳細検証するが、 executor も最低限 file:// で開いて表示確認すること)

## Verification strategy

このプロジェクトは ビルド / npm / lint インフラなし (制約上 push 不可)。 verifier が実施するのは以下:

- **Build**: なし (vanilla HTML/JS、 ビルドステップなし)
- **Type check**: なし (JavaScript)
- **Lint**: なし (project に lint 設定がない、 spec も要求していない)
- **Tests**: 自動 test なし (E2E framework 導入は単一ファイル制約に反するため不可)
- **Manual (verifier が手動 or DOM 検査で実施)**:
  - `index.html` を file:// で開いて 7 つの AC を順に確認
  - DevTools Console に error が出ていないこと
  - DevTools Application > Local Storage に `todos.v1` キーが追加され、 リロード後に list が復元されること
  - `<script>alert(1)</script>` 文字列を TODO として追加 → DOM 上は textContent として表示され alert が出ない (AC8)
  - 空 / 空白のみ submit が無視される (AC6)
  - DevTools の Device toolbar で 375px (iPhone SE 相当) に切り替えてレイアウト崩れがない (AC7)
  - localStorage に手動で不正 JSON (`'not-json'`) を入れた状態でリロード → アプリが空 list で起動する (AC11)
- **静的 review**:
  - `index.html` が **単一ファイル** で完結していること (他に file を作っていないこと)
  - JS 側で `innerHTML` を user 入力に対して使っていないこと (XSS 対策の static check)
  - 外部 CDN / `<script src="http">` を参照していないこと (file:// で動く制約)

## Test design analysis

`pev-test-design` skill 相当の self-check 結果。

### 同値分割

- **TODO テキストの input カテゴリ**:
  - 通常テキスト (1-100 文字程度) → 受け入れる (AC2)
  - 空文字 / 空白のみ → 拒否 (AC6)
  - HTML 特殊文字を含む文字列 → 受け入れる、 ただし escape して表示 (AC8 derived)
  - 絵文字 / 多言語 → 受け入れる (AC10 derived)
  - 非常に長い文字列 (10000 文字 +) → spec 上は規定なし、 §Defensive defaults 参照

### 境界値

- **TODO テキストの長さ**: 0 文字 (空) → 拒否、 1 文字 → 受け入れる。 上限は spec で規定なし → §Defensive defaults 参照
- **TODO 件数**: 0 件 → empty state (AC9 derived)、 1 件 → 通常動作、 大量 (1000 件 +) → localStorage 容量限界の risk あり、 §Risks 参照

### デシジョンテーブル

簡素な単一機能のため明示的なデシジョンテーブルは不要。 input 検証は「空 or 空白のみ → 拒否、 それ以外 → 受け入れる」 の 1 軸のみ。

### 状態遷移

- TODO の状態: `未完了 (done=false)` ↔ `完了 (done=true)` の 2 状態、 checkbox で双方向遷移可能
- ライフサイクル: 存在しない → 追加で `未完了` 状態で create → toggle で `完了` ↔ `未完了` → 削除で消滅。 削除済 TODO は復元 path なし (spec で undo 要求されていない)

### エラー推測 (error-patterns catalog 参照)

該当する pattern:

- **XSS** (Trigger: user-generated content) → AC8 で対策明示
- **Empty / Null edge case** (Trigger: 初期 state、 0 件 list) → AC9 で対策明示
- **文字コード / 国際化** (Trigger: text input) → AC10 で対策明示
- **二重送信** (Trigger: form submit) → 単一クライアント / 即時 sync 完結なので影響軽微、 ただし AC2 で「空でない場合のみ追加」 の挙動が連打でも safe (state を毎回 trim/check するため)。 Risks セクションで言及
- **partial failure** (Trigger: localStorage write 失敗 / QuotaExceededError) → §Risks で言及
- **巨大 payload** (Trigger: text input) → 単一ファイル制約 + spec 規定なしのため defensive (cap なし、 ただし localStorage 5MB 上限に当たれば save 失敗) → §Risks
- 該当しない: SQL injection (DB なし)、 認可漏れ (single user)、 race condition (single tab 前提、 multi-tab は §Risks に記載)、 timezone (date 機能なし)

### チェックリスト (該当 category)

categry: **screen** (UI のみ、 server / API なし)。 screen 系チェックリスト相当の確認項目:

- empty state あり (AC9)
- form 検証あり (AC6)
- mobile breakpoint 確認 (AC7、 375px)
- keyboard 操作 (Enter 送信、 AC2)
- 永続化動作 (AC5)

### Defensive defaults (unspecified input)

spec で「許容する」 と明記されていない grey zone を defensive (拒否 / no-op / silent ignore) でハンドリング。 plan に列挙して、 executor が暗黙に「許容」と扱わないようにする:

- **空文字 / 空白のみの TODO** → reject (silent no-op、 form は clear せず input を残す)。 reason: AC6 で明示
- **localStorage parse error / 不正 JSON** → silent ignore + 空 list で起動。 reason: spec は復旧方法を規定していないが、 crash させると AC1 (一覧が表示される) を満たせなくなる
- **localStorage が無効化されたブラウザ** (private mode 等) → save 失敗 を try/catch で握りつぶし、 in-memory 動作は継続。 reason: spec の AC1-AC4 は「画面が動く」 を最優先、 AC5 (永続化) は満たせないが crash よりは良い
- **非常に長い text (10000+ 文字)** → spec で上限規定なし → 受け入れる (cap なし)。 ただし localStorage 5MB 制限で全体 save が失敗する可能性は §Risks に記載。 reason: spec が「テキストを入力して」 と一般化しているため、 任意上限を勝手に設けると逆に仕様逸脱
- **HTML 特殊文字を含む input** → 受け入れる (AC10)、 ただし表示時に textContent で escape (AC8 で対策)。 reason: 「TODO のテキスト」 は文字列であり、 markup でも code でもない
- **複数タブで同時編集** → spec で規定なし、 単純な last-write-wins (各タブが自分の memory state を localStorage に書き込む)。 reason: タブ間 sync は単一ファイル制約と spec scope を超える

## Risks / Rollback

- **localStorage QuotaExceededError** (5MB 上限): 大量 TODO で save が失敗 → mitigation: `saveToStorage` を try/catch、 失敗時は console.warn で記録し、 in-memory state は維持 (AC5 は破れるが AC1-AC4 は守る)
- **multi-tab race**: 同じドメインの別タブで同時編集 → 後勝ち、 タブ間 sync は実装しない (spec scope 外、 single-user 前提)
- **file:// セキュリティ制約**: 一部ブラウザは file:// で localStorage を制限することがある → mitigation: try/catch、 動作不能時は console に明示メッセージ。 Chrome / Safari 最新は file:// + localStorage 動作 OK (確認済)
- **XSS**: user 入力を `innerHTML` で挿入すると script 実行可能 → mitigation: `textContent` のみ使用、 element 構築は `document.createElement` (implementation order step 3 で明示)
- **id 衝突**: `crypto.randomUUID()` 未対応の古いブラウザでは undefined → mitigation: spec で「モダンブラウザのみ」のため Chrome / Safari 最新は対応済 (Chrome 92+ / Safari 15.4+)。 必要なら `Date.now() + Math.random()` fallback を 1 行で追加可
- **連打による二重 add 風挙動**: form を Enter で素早く 2 回押す → 2 回目は input が空 (1 回目で clear 済) → AC6 のバリデーションが弾く、 結果として safe (実装で input clear のタイミングを「addTodo の成功後」 にすれば自然に守られる)

Rollback: 単一ファイルなので `rm index.html` 1 つで完全に元に戻る。 リポジトリ管理外の cwd であり、 既存資産破壊 risk なし。

## Estimated task budget

executor 想定: 約 8-15k tokens (単一ファイル、 約 150-200 行の HTML/CSS/JS、 ロジック単純)

verifier 想定: 約 5-10k tokens (静的 review + AC チェック)

合計 Phase 2 + 3 で 20-25k tokens 程度、 50k budget 内に十分収まる。

## Executor 向けハンドオフ notes (重要)

- **innerHTML を user 入力に対して絶対使わない**。 `element.textContent = todo.text` で escape を自動取得
- **event delegation 推奨**: `#todo-list` に 1 つの click/change listener、 `data-action="toggle"` / `data-action="remove"` + `data-id="<uuid>"` で row 識別
- **render() は毎回 list を作り直す** (差分更新しない)。 単純化のため、 件数が少ない前提では十分速い
- **localStorage key は `todos.v1`** で固定 (将来のスキーマ変更に version 余地を残す)
- **CSS は OS native font** (`system-ui, -apple-system, sans-serif`) — 外部 font CDN 禁止
- **viewport meta** を忘れない (モバイル幅 AC7 のため必須)
- **form submit で preventDefault** を呼び忘れるとページが reload する事故が起きるので注意
- **入力 clear のタイミング**: addTodo 成功時のみ input.value を空に (空 submit が拒否されたら入力を残してユーザーに修正余地を与える)
