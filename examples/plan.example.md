# Plan for: Add /healthz endpoint

## Goal
src/server.ts に GET /healthz endpoint を追加する。サーバの生存確認に使う。

## Constraints
- 新規依存追加禁止
- TypeScript strict mode 維持
- 既存ルーティング層 (Express) を踏襲

## Acceptance Criteria
- [ ] GET /healthz が 200 を返す
- [ ] レスポンスが {status: "ok"} の JSON
- [ ] tests/server.test.ts に対応するテストが追加されている
- [ ] `pnpm test` が全 PASS

## File-level changes
- [ ] src/server.ts — `/healthz` ルート追加 (line ~45、既存の `/` の直下に挿入)
- [ ] tests/server.test.ts — 新規テストケース追加

## Implementation order
1. src/server.ts に `/healthz` ハンドラを追加
2. tests/server.test.ts に supertest ベースのテストを追加
3. `pnpm test` で動作確認 (verifier が実行)

## Verification strategy
- Build: `pnpm build`
- Type check: `pnpm typecheck`
- Lint: `pnpm lint`
- Tests: `pnpm test`
- Manual: `curl http://localhost:3000/healthz` で 200 + JSON 確認

## Risks / Rollback
- Risk: 既存ルートと衝突する可能性
  - Mitigation: 既存ルート一覧 (`grep -E "router\\.(get|post)" src/server.ts`) で重複なしを事前確認済み
- Rollback: `git revert <commit>` 1コミットで戻る単純な追加

## Estimated task budget
47000 tokens
