# Changelog

All notable changes to pev-harness will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (planned for v0.2)
- Auto Mode integration: `permissionMode` detection in `/pev` for Gate A bypass
- task_id tracking with `~/.claude/pev/{task_id}/` memory directory standardization
- Stop hook auto-invocation of `/pev-verify`

### Changed (planned)
- `commands/pev*.md` to embed actual Bash logic (currently descriptive only)

## [0.1.0] - 2026-05-11

Initial scaffold release. Plan-Execute-Verify coding harness for Claude Opus 4.7.

### Added

#### Core Components
- 3 agents: `planner`, `executor`, `verifier`
- 8 skills: `pev-pipeline`, `pev-spec-template`, `pev-task-budget`, `pev-focus-mode`, `pev-recap`, `pev-subagent-memory`, `pev-dual-review`, `pev-team-conventions`
- 5 commands: `/pev`, `/pev-plan`, `/pev-execute`, `/pev-verify`, `/pev-status`
- 3 hooks: `PreToolUse` (safety guard), `Stop` (verify prompt), `SessionStart` (task resume detection)
- 2 rules: `pev-conventions`, `4.7-native`

#### Documentation
- `SPEC.md` (12 sections + 5 ADRs)
- `README.md` (public-facing)
- `CLAUDE.md` (plugin manifest for Claude Code)
- `ONBOARDING.md` (team rollout guide)

#### Examples
- `examples/plan.example.md`
- `examples/execute.example.log`
- `examples/verify.example.json`
- `examples/verify.fail.example.json`
- `examples/recap.example.log`
- `examples/team-conventions.example.md`
- `examples/sample-project/` (minimal dog food project)

#### Infrastructure
- `.gitignore` for `artifacts/` and local settings
- `settings.json` with team defaults (model: opus, effort: xhigh, permissionMode: default)
- `.claude-plugin/plugin.json` manifest
- GitHub Actions CI for markdownlint + JSON schema validation

### Design Decisions

See `SPEC.md` Section 12 for full ADR log:

- ADR-001: Why fixed 3-phase pipeline (Plan / Execute / Verify)
- ADR-002: Why dropped external CLI dependency for dual-review
- ADR-003: Why `artifacts/` is gitignored
- ADR-004: Why parallel executor max is 3
- ADR-005: Why Stop hook handles verify auto-invocation

### Known Limitations

- Dual review uses same model family (Claude only) — true model diversity deferred to v2.0
- Language-specific tooling not bundled — relies on project-side formatter/linter
- Windows untested — macOS / Linux only verified
- `task_budget` API beta header passthrough is partial in Claude Code v2.1.x

[Unreleased]: https://github.com/myksyut/pev-harness/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/myksyut/pev-harness/releases/tag/v0.1.0
