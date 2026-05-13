# Team Conventions

このファイルは pev-harness の **triage (v3.0+) / planner / executor / verifier** に自動 inject されるチーム規約。 `/pev-init` が言語検知で初期値を埋めるので、 各 placeholder を実値に書き換えてください。

## Language & Stack

- Language: `<e.g., TypeScript / JavaScript / Python / Go / Rust>`
- Runtime: `<e.g., Node.js >= 20 / Python >= 3.11 / Go 1.22>`
- Package manager: `<npm / pnpm / yarn / uv / poetry / cargo / go mod>`

## Verification commands

verifier が Phase 3 で実行する command 群。 該当しない項目は `未設定` を明記する (推論コスト削減のため省略不可、 v1.8+)。

- Unit test: `<command>` または 未設定
- E2E test: `<command>` または 未設定
- Lint: `<command>` または 未設定
- Typecheck: `<command>` または 未設定

## Code style

- `<e.g., Named exports only / kebab-case file names / 2-space indent / semicolons required>`
- `<e.g., 早期 return を優先、 nested if-else は避ける>`
- `<e.g., console.log を残さない (debug 用は削除してから commit)>`

## Commit policy

- Conventional commits (`feat:` / `fix:` / `chore:` / `docs:` / `test:` / `refactor:`)
- 1 logical change = 1 commit
- 1 PR = 1 feature or 1 fix (small PR culture)

## Notes for pev-harness

- `permissionMode: default` を維持する (Gate A での人間レビュー必須)
- `artifacts/` は gitignore 対象、 task 完了後に `/pev-status --clean`

<!--
拡張 section の例 (必要に応じて追加):

## Forbidden
- 避けるべき pattern (例: console.log 残し、 any without FIXME、 process.env 直読み)

## Files to never touch
- 触らない path (例: migrations/*、 legacy/*、 secrets.example.env)

## Review rubric (--strict 時に追加チェック)
- Security: OWASP Top 10、 secret hardcode 検出
- Performance: N+1 queries 検出
- Accessibility: WCAG 2.1 AA
- API: public endpoint に OpenAPI annotation 必須

## アーキテクチャ規約
- 各 layer の責務分離、 依存方向、 副作用 isolation 等

## Recommended patterns
- エラーハンドリング: `Result<T, E>` 型
- 非同期処理: try/catch ではなく Result.fromPromise() でラップ
-->
