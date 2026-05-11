# Plan for: implement add(a, b)

## Summary

Replace the `throw` body of `add` in `src/index.js` with `return a + b;`. Single-line edit; no other files touched.

## Goal

Implement `add(a, b)` in `src/index.js` to return `a + b`.

## Constraints

- Follow `team-conventions.md`: named exports only, 2-space indent, semicolons, no `console.log`, no TS migration.
- Minimal change — do not touch tests, do not add new files.

## Acceptance Criteria

- [ ] `npm test` exits 0 (both vitest cases pass: `add(2,3)===5`, `add(-1,-1)===-2`).
- [ ] `src/index.js` retains the named export `add` (no default export added).
- [ ] No `console.log` introduced; 2-space indent and trailing semicolon preserved.

## File-level changes

- [ ] `src/index.js` — replace the function body. Remove the TODO comment on line 1. Final form:

  ```js
  export function add(a, b) {
    return a + b;
  }
  ```

## Implementation order

1. Edit `src/index.js`: drop the TODO comment and the `throw`; return `a + b`.

## Verification strategy

- Tests: `npm test` (from `/Users/miyakishota/pev-harness/examples/sample-project`)
- Lint: `npm run lint` (no-op placeholder, exits 0)
- Type check: `npm run typecheck` (no-op placeholder, exits 0)
- Manual: none required.

## Risks / Rollback

- Risk: accidental default export or stray `console.log` — mitigation: keep diff to function body only.
- Rollback: `git checkout -- src/index.js`.

## Non-goals

- No new test cases (constraint forbids touching tests).
- No edge-case handling beyond what tests require (e.g. non-numeric inputs are out of scope).

## Estimated task budget

~2k tokens (trivial single-line edit + verify).
