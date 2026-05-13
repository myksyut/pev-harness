# Spec — 申込フォームに「キャンセル機能」 を追加 (内心 PM spec、 agent には開示しない)

**Status**: Reference (orchestrator 採点用、 spec.md は agent に渡さない)
**Target**: examples/sample-project (event signup form)
**Predecessor experiments**: harness-effect-v3-dogfood/ (= 「ご質問・ご要望」 textarea 追加)

## 背景 / Why

イベント参加申込を 誤って submit してしまった user が、 その場で取り消したい。 軽量な解決として、 申込直後の success message から 1 click で取り消せる UI を追加。

## 機能要件 (= 仮想 user の内心 wish)

### F1. UI 配置

- 申込完了後の success message (`<div id="success">`) の内部に「キャンセルする」 button を追加
- success message が hidden の状態では cancel button も hidden (= form 編集中に出さない)

### F2. キャンセル可能な対象

- **直前の 1 件のみ** (= localStorage `pev-sample-submissions` の **最後の 1 件**)
- 過去全件の一覧表示は scope 外

### F3. 確認 dialog

- click 時に `window.confirm()` で「申込をキャンセルしますか?」 を確認
- OK で実行、 cancel で no-op

### F4. キャンセル実行

- localStorage の **最後の 1 件を pop**
- success message を hidden、 form を reset

### F5. キャンセル後の表示 message

- 「申込をキャンセルしました」 と表示、 warning 色 (amber 系)
- 既存 success と同 pattern (form 編集開始で hidden)

### F6. アクセシビリティ

- button: aria-label="申込をキャンセル"、 既存 pattern 踏襲

### F7. 既存挙動の保持

- 既存 5 field の validation / 永続化 / 二重送信防止 を変更しない
- 既存 unit / E2E test 全 PASS を維持

## acceptance criteria (採点用)

- [ ] AC1: success message 内に「キャンセルする」 button が表示される
- [ ] AC2: click で confirm dialog、 OK で実行 / cancel で no-op
- [ ] AC3: 実行時に localStorage の最後の entry が pop される
- [ ] AC4: 実行後 success message が hidden、 form が reset される
- [ ] AC5: 「申込をキャンセルしました」 message が表示される (warning 色)
- [ ] AC6: success が hidden の時は cancel button も hidden
- [ ] AC7: 既存 unit test 全 PASS のまま
- [ ] AC8: 既存 E2E test 全 PASS のまま
- [ ] AC9: 新規 test が追加され、 cancel の正常パス + 複数 entry の最後 pop を覆う
- [ ] AC10: console error / pageerror が出ない
