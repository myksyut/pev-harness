# Spec — イベント申込フォームに「ご質問・ご要望」 欄を追加

**Status**: Ready for implementation
**Owner**: PM (sample)
**Target component**: examples/sample-project (event signup form)

## 背景 / Why

参加者が申込時に質問・要望を任意で送れるようにする。 当日運営の改善 + 個別対応の参考にする。

過去 3 イベントで「事前に質問する場がなく、 当日の Q&A セッションが時間切れ」 とのフィードバックが複数あった。 任意の自由記述欄を追加することで、 事前収集 → 当日への反映を狙う。

## 機能要件 (必須)

### F1. フィールド配置

- 既存 form の **「利用規約に同意します」 の上** に新規 textarea を配置
- label: 「ご質問・ご要望 (任意)」
- 任意項目 (空文字でも submit 成功)

### F2. 入力制限と validation

- 最大 500 文字
- 501 文字以上で submit を試みると error 表示 (既存 error pattern と同じ)
- error message: 「ご質問・ご要望は 500 文字以内で入力してください」

### F3. 文字数カウンタ

- 入力欄のすぐ下 (error message と同位置 / 同 row) に **リアルタイム文字数カウンタ** を表示
- 表示形式: 「`現在の文字数 / 500`」 (例: `42 / 500`)
- 入力するたびに更新される (input event)
- 残り文字数が 50 以下になると counter の文字色を warning (orange #d97706 想定) に変更
- 残り文字数が負 (= 500 超過) のとき counter 文字色を error (red #dc2626) に変更
- form.reset() 時に counter も「0 / 500」 に戻る

### F4. 永続化

- LocalStorage の submission entry に `inquiry` field として保存 (空の場合は空文字列 `""`)
- 既存 entry が `inquiry` field を持っていなくても (= 後方互換)、 load / display / 後続処理が破綻しない

### F5. 既存機能の保持

- 既存 5 field (name / email / phone / plan / agreement) の挙動を一切変更しない
- 既存 unit test / E2E test を **全て pass のまま** にする

## UI 要件

- textarea の rows: 4
- placeholder: 「当日の質問や要望があればご記入ください (500 文字以内)」
- accessibility:
  - `aria-required="false"` (既存 phone と同 pattern)
  - `aria-describedby="inquiry-error inquiry-counter"`
  - counter は `<div id="inquiry-counter" class="counter">`、 既存 `.error` と同 column / `aria-live="polite"`
- 既存 form の CSS / styling pattern を踏襲 (新規 CSS class を増やす場合は `.counter` 1 つに収める)

## test 要件

### Unit test (`tests/validation.test.js` に追記)

- inquiry validator の境界値網羅:
  - 空文字 → null (OK)
  - 1 文字 → null
  - 500 文字 → null
  - 501 文字 → 上記 error message
- 既存 validateForm aggregate に `inquiry` field を追加

### Unit test (`tests/form.test.js` に追記)

- inquiry が空の submit が成功し、 submission entry に `inquiry: ""` が含まれる
- inquiry が `"質問あります"` の submit が成功し、 entry.inquiry にそのまま保存される
- 後方互換: `inquiry` field のない既存 entry が load されても crash しない (Array filter 等の挙動を test)

### E2E test (`tests-e2e/seed.spec.ts` に追記)

- 既存「正常パス」 シナリオを拡張: inquiry に `"質問テスト"` を入力 → submit → success message + LocalStorage に inquiry が保存されている assertion
- 新規シナリオ: 501 文字を入力 → submit → error message 表示、 submission は **作成されない**
- counter のリアルタイム更新を 1 ケース test (例: "abc" 入力で counter が `3 / 500` と表示)

### 既存 test 全 PASS の維持

- `npm test` (vitest) と `npx playwright test` の両方が green であること
- 新規 test の追加で既存 test が break しない

## 非機能 / 制約

- `team-conventions.md` の規約に従う (JS ESM / vitest / 2-space indent / single quotes / 名前付き export only)
- console error / pageerror を出さない (E2E test fixture が監視)
- TypeScript への移行はしない (規約)
- 外部 library 追加は禁止 (pure vanilla JS で実装)
- inquiry の textarea には XSS 防御を含む (DOM 挿入時 `textContent` 経由、 既存と同様)

## scope 外

- 既存 success message の表示内容変更 (現状の「申し込みを受け付けました (◯◯ 様)」 のまま)
- inquiry の事後編集 / 削除 UI
- 管理画面 (申込一覧表示) は別途別 spec で対応

## acceptance criteria

- [ ] AC1: index.html を開くと「利用規約に同意します」 の上に textarea + counter が表示される
- [ ] AC2: 0-500 文字 で submit 成功、 inquiry が LocalStorage entry に含まれる
- [ ] AC3: 501 文字以上で submit すると error 表示、 entry は作成されない
- [ ] AC4: 入力中、 counter が `<文字数> / 500` でリアルタイム更新
- [ ] AC5: 残り 50 文字以下で counter が warning 色、 残り 0 未満で error 色
- [ ] AC6: form.reset() 後に counter が `0 / 500` に戻る
- [ ] AC7: `npm test` で既存 + 新規 全 PASS
- [ ] AC8: `npx playwright test` で既存 + 新規 全 PASS
- [ ] AC9: 既存 5 field (name/email/phone/plan/agreement) の validation / 挙動が変わらない
- [ ] AC10: console error / pageerror が出ない
