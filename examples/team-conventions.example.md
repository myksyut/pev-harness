# Team Conventions

このファイルをプロジェクトルートにコピーして `team-conventions.md` にリネームし、内容を編集してください。pev-harness の planner/executor/verifier が自動で読み込みます。

## Language & Stack

- Language: TypeScript (strict mode必須)
- Runtime: Node.js >= 20
- Package manager: pnpm

## Code style

- Prefer named exports over default exports
- File naming: kebab-case
- Test files: `*.test.ts` (vitest)
- Max line length: 100 chars
- Indent: 2 spaces

## Commit policy

- Conventional commits (`feat:` / `fix:` / `chore:` / `docs:` / `test:` / `refactor:`)
- 1 logical change = 1 commit
- 1 PR = 1 feature or 1 fix (small PR culture)
- PR description は plan.md の Goal セクションを引用

## Review rubric (--strict 時に追加チェック)

- **Security**: OWASP Top 10 — secret/credential のhardcode検出、SQL injection、XSS、CSRF
- **Performance**: N+1 queries の検出 (特に src/api/*)
- **Accessibility**: WCAG 2.1 AA (src/components/*)
- **API**: 全 public endpoint に OpenAPI annotation必須

## Forbidden

- `console.log` を production code に残す (loggerを使う)
- `any` type を `// FIXME` コメントなしで使う
- 環境変数を直接 `process.env.X` で読む (`src/config/env.ts` 経由)
- 既存ライブラリと重複する utility の新規追加

## Recommended patterns

- エラーハンドリングは `Result<T, E>` 型を使う (`src/lib/result.ts`)
- 非同期処理は `try/catch` ではなく `Result.fromPromise()` でラップ
- DI コンテナを使わず、関数の引数で依存を注入

## Files to never touch

- `src/legacy/*` — 廃止予定、新規変更禁止 (削除のみ可)
- `migrations/*` — 別 PR で migration の rollback plan と共に変更
- `secrets.example.env` — 値を埋めない

## Notes for pev-harness

- `permissionMode: default` を維持する (Gate A での人間レビュー必須)
- `--strict` は main マージ前必須
- artifacts/ は gitignore 対象、PR 前に `/pev-status --clean`
