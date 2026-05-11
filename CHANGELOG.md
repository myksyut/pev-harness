# Changelog

All notable changes to pev-harness will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v0.5+
- See open Issues #6-#9 on GitHub

## [0.4.0] - 2026-05-11

Dual review release: pev-dual-review skill rewritten with executable Agent tool spawn protocol, structured JSON merge logic, and an agreement_pct metric for measuring model diversity health.

### Added
- `examples/verify.strict.example.json` — concrete example of `--strict` mode output showing reviewer_a / reviewer_b / merged sections (closes #5)
- agreement_pct metric in merged section — measures how often Reviewer A and B catch the same issue; 100% suggests rubric is too loose, low values indicate healthy model diversity

### Changed
- `skills/pev-dual-review/SKILL.md` — rewritten from pseudocode to executable spec:
  - Concrete Agent tool spawn pattern (same-message parallel dispatch)
  - Complete Reviewer prompt template
  - JSON merge logic with dedupe-by-substring
  - Reviewer A/B differentiation rationale (Opus xhigh for arch + Sonnet high for impl correctness)
- `commands/pev-verify.md` — `--strict` 動作詳細 section added with concrete 6-step flow
- `agents/verifier.md` — `--strict` mode responsibilities expanded (verifier is now the parent agent that spawns A/B and merges)

### Known limitations carried forward
- Model diversity is partial: both reviewers are Claude family. True external-model diversity deferred to v2.0 (#9)
- v0.4 logic not yet exercised in dog food; first real strict-mode run will validate the same-message parallel spawn pattern

## [0.3.0] - 2026-05-11

Quality release: verifier now writes durable memory, task_budget skill rewritten for Claude Code v2.1.x reality. Verified end-to-end via second dog food run.

### Added
- `agents/verifier.md` — explicit "Memory write" directive: write per-check evidence and AC verification reasoning to `~/.claude/pev/{TASK_ID}/verifier.md`. Retry rounds append rather than overwrite, preserving the full verification history (closes #4)

### Changed
- `skills/pev-task-budget/SKILL.md` — completely rewritten to reflect Claude Code v2.1.x reality:
  - Layer 1: agent prompt embedded "Estimated task budget" (dog food confirmed working)
  - Layer 2: `ANTHROPIC_BETA=task-budgets-2026-03-13` env var for users who want API beta header
  - Honest limitation notes about v0.x partial passthrough
  - v2.0+ roadmap link via #9 for true MCP-server-based external model support
  - (closes #3)

### Verified via dog food (v0.2 features now confirmed)
- ✅ Gate A (permissionMode=default) halts after Phase 1 as designed
- ✅ planner Memory write produces structured `~/.claude/pev/{TASK_ID}/notes.md` with Key decisions / Notes for executor / Notes for verifier / Open questions sections
- ✅ Stop hook auto-appends Phase completion entries to `recap.log`
- ✅ team-conventions.md content automatically included in plan.md Constraints section

### Known limitations carried forward
- Stop hook still cannot invoke `/pev-verify` slash command — user-triggered (limitation of Claude Code hook system)
- Phase 2/3 dog food validation pending — requires `permissionMode=auto` or manual `/pev-execute` continuation

## [0.2.0] - 2026-05-11

Functional release: Gate A actually decides on permissionMode, task lifecycle has real cleanup paths, and recap.log is no longer dependent on agent goodwill.

### Added
- `commands/pev.md` — concrete Bash for task_id init, permissionMode-aware Gate A branching, retry counter (closes #1)
- `commands/pev-status.md` — `--gc` / `--gc --apply` modes for 30-day stale memory directory cleanup, plus `--recent` and `--escalate` (closes #2)
- `agents/planner.md` — explicit "Memory write" directive: write key decisions and open questions to `~/.claude/pev/{TASK_ID}/notes.md`
- `agents/executor.md` — explicit "Memory write" directive: read peer executors' memory at startup to avoid file collisions; write own progress on completion
- SessionStart hook — surfaces stale tasks (>30 days) with `/pev-status --gc` hint

### Changed
- `hooks/hooks.json` Stop hook — now auto-appends Phase 2/3 completion entries to `artifacts/recap.log`, addressing the dog food gap where recap was relying on agent-side initiative
- Stop hook also surfaces verdict (PASS/FAIL from verify.json) when verifier has run

### Fixes
- Dog food gap: Phase completion now leaves a durable record in recap.log without requiring agent compliance
- Dog food gap: subagent memory directory `~/.claude/pev/{task_id}/` now has explicit write directives in agent prompts

### Known limitations carried forward
- Stop hook still cannot directly invoke `/pev-verify` (Claude Code hooks don't yet support command-triggered slash invocations); user must run `/pev-verify` manually after seeing the Stop hook message
- `task_budget` API beta header passthrough still indirect (Issue #3)

## [0.1.1] - 2026-05-11

Patch release: CI fix, agent frontmatter improvements, skill-finder addition, dog food validation.

### Added
- `skills/skill-finder/SKILL.md` — meta-skill for evaluating external skills before adoption (adapted from mizchi/skills)
- `examples/dog-food-evidence/` — concrete artifacts from automated dog food run (plan.md + execute.log)
- `effort` field on all 3 agents (planner: xhigh, executor: high, verifier: xhigh) — confirmed officially supported in Claude Code v2.1.x

### Changed
- `commands/pev*.md` — simplified, removed embedded Bash blocks (deferred to v0.2 with Issue links)
- `.markdownlint.json` — disabled noisy rules (MD040/MD031/MD032/MD022/MD034) for documentation-heavy repo
- `examples/sample-project/src/index.js` — restored TODO state after dog food (kept as recurring test fixture)
- `.gitignore` — added `node_modules/` and `package-lock.json` for examples/sample-project

### Fixed
- CI workflow now passes (markdownlint rules tuned)

### Confirmed via dog food
- ✅ Phase 1 (Plan) generates high-quality plan.md with team-conventions.md awareness
- ✅ Phase 2 (Execute) successfully implements minimal changes
- ✅ Acceptance Criteria checked via real test execution (vitest 2/2 PASS)
- ⚠️ Stop hook auto-trigger of verify did not fire in headless mode → Issue #4
- ⚠️ recap.log auto-write missing → Issue #4
- ⚠️ subagent memory directory empty → Issue #2

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
