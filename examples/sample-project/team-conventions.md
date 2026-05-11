# Team Conventions (sample-project)

## Language & Stack

- Language: JavaScript (ESM)
- Runtime: Node.js >= 20
- Unit test runner: vitest
- E2E test runner: Playwright (`tests-e2e/`, `playwright.config.ts`)
- 静的サーバー: http-server (port 8080)

## Code style

- Named exports only (no default exports)
- 2-space indent / semicolons required / single quotes
- 早期 return を優先、 if-else のネストは避ける
- `console.log` を残さない (debug 用は削除してから commit)
- TypeScript への移行はしない (このプロジェクトは JS ESM 固定)

## アーキテクチャ規約 (フォーム系画面)

- **責務分離**:
  - `src/validation.js` — 純関数のみ。 DOM/Storage/window を import しない
  - `src/form.js` — submit logic / 永続化 / 二重送信制御。 validation の結果を受け取って状態遷移する
  - `index.html` — UI と上記 module の glue。 validation logic を直接書かない
- **入力検証**:
  - 各 field の error は `<div id="{name}-error">` に表示する (aria-live=polite, role=alert)
  - validation は submit 時に **同期** で実行 (form 規模では十分)
  - validation error は **日本語**、 UI にそのまま表示する形式で返す
- **二重送信防止**:
  - submit 中は submit button を `disabled` にする (mandatory)
  - submit 中の再 invoke は handler 側でも flag で弾く (button disable と二重防御)
- **永続化**:
  - LocalStorage への append-only。 key は module 側で export して test と共有
  - JSON parse 失敗時は `[]` にフォールバックして crash しない
- **accessibility**:
  - 各 input に対応する `<label for="...">` を必須
  - 必須項目は `aria-required="true"`
  - error 要素は `aria-describedby` で input と紐付け
- **副作用の隔離**:
  - LocalStorage / Date / setTimeout は引数で注入できるようにし、 unit test では mock 差し替え可能にする

## Test 規約

- Unit test (`tests/`):
  - vitest + mock storage で完結 (jsdom 不要)
  - validation 系は **境界値** (空、 最大長、 形式不正、 1文字超過) を網羅
  - 副作用付き関数は mock storage を渡す形で test
- E2E test (`tests-e2e/`):
  - Playwright。 `goHome` helper で navigation + `localStorage.clear()` を必ず行う
  - console error / pageerror は `beforeEach` で監視 (seed.spec.ts に DRY fixture あり)
  - 状態遷移を assert (form input → click → success message visible + form reset)

## Verification commands

- Unit test: `npm test` (vitest、 `tests/` のみ scope)
- E2E test: `npx playwright test` (`tests-e2e/` 配下)
- Lint: 未設定 (このプロジェクトでは lint チェックなし)
- Typecheck: 未設定 (JS ESM 固定、 TypeScript 化はしない)

## Commit policy

- Conventional commits
- 1 commit に複数の関心事を混ぜない (validation 修正 + UI 修正は別 commit)

## Notes

これは pev-harness の dog food fixture。 実プロダクトの規約は別途各チームで定義する想定 (この `team-conventions.md` は plan/execute/verify 各 phase に inject される sample)。
