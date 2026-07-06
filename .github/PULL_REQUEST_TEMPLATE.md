<!-- Thanks for contributing to pev-harness! -->

## What

<!-- 1-3 sentences describing the change. -->

## Why

<!-- Linked issue (Fixes #123) or short rationale. -->

## How verified

<!-- pev-harness CI must pass. Additionally: -->

- [ ] Ran `/pev-harness:pev` against `examples/sample-project/` and confirmed expected behavior
- [ ] If agent / skill / command was changed: dog food evidence attached (.pev-artifacts/ snapshot or screenshot)
- [ ] If hooks/ was changed: tested with `permissionMode=default` (Gate A must still halt)

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor
- [ ] Breaking change (please describe migration path)

## Checklist (PEV conventions)

- [ ] `rules/native-prompting.md` の禁止フレーズ (blanket な "step by step" / 無条件 "double-check" 等) を agent/skill/command prompt に**追加していない** (AC/test criteria に対する scoped verify 指示は許可)
- [ ] team-conventions.md / SPEC.md / CHANGELOG.md を更新 (該当する場合)
- [ ] commit message が conventional commits 形式

## Notes for reviewers

<!-- Anything reviewer should know: tricky parts, alternatives considered, open questions. -->
