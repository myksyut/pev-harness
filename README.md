# pev-harness

[![CI](https://github.com/myksyut/pev-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/myksyut/pev-harness/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/myksyut/pev-harness?style=social)](https://github.com/myksyut/pev-harness/stargazers)
![version](https://img.shields.io/badge/version-3.7.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![claude--code](https://img.shields.io/badge/Claude%20Code-%E2%89%A5v2.1.111-purple)

**A Claude Code plugin for Claude Opus 4.8 — (Triage →) Plan → Execute → Verify pipeline (v3.0+).**

> ⭐ **If you find this useful, please [star the repo](https://github.com/myksyut/pev-harness/stargazers)** — it helps other Claude Code users discover the project.

## Why this exists

Claude Opus 4.7 以降「step by step」「double-check」のような 4.6 時代の prompting scaffolding が **逆効果** になることが公式に明示された (4.8 でも同方針、 むしろ literal instruction-following が強化された)。一方 Claude Code 側にも `xhigh` effort / Auto Mode / Focus Mode / Task Budget など 4.X native 機能が増えた。

これらを前提に **ゼロベースで再設計** した結果が pev-harness。 既存のコーディングハーネスを 4.X 向けに改造するのではなく、4.X 時代に**最初から書くなら何が必要か**を抜き出した。

## What it does (v3.0+)

入力: 自然文タスク → `/pev "Add /healthz endpoint that returns {status:'ok'}"`

```text
  Phase 0 [TRIAGE]   sonnet + low   →  artifacts/triage.json (v3.0+)
       ↓             Plan 必要性を判定 (cwd context + prompt 曖昧度)
       │
       ├── plan_required ──→ Phase 1 [PLAN]    opus + xhigh   →  artifacts/plan.md
       │                        ↓                Gate A: permissionMode で human-approval
       │                     Phase 2 [EXECUTE] sonnet + high  →  code changes + execute.log
       │                        ↓                Gate B: Stop hook が verify を促す
       │                     Phase 3 [VERIFY]  sonnet + xhigh →  artifacts/verify.json (PASS/FAIL)
       │
       └── plan_skip ──→ Phase 2 [EXECUTE] (plan-less mode、 cwd context + task description で直接実装)
                            ↓
                         Phase 3 [VERIFY]
       ↓
  PASS → done    FAIL → planner に戻る (max 3 retries)
```

- **Triage agent (v3.0+)** が cwd 構造 + prompt 曖昧度から Plan 必要性を判定 (= 軽量 router、 多くの実務 task で Plan skip)
- **Plan の質問返し (v3.0+)** で「user の頭の中の spec を引き出す」 — UI 拡張要素 / 表示 detail / nice-to-have は質問必須
- **Defensive default の scope 限定 (v3.0+)** — security / data integrity / 状態不整合 のみに適用 (= v2.1.6 の minimal 倒れ問題を解消)
- **Gate A の人間承認** (Plan 起動時のみ) で、軽微なタスクは `auto` で流し、重要変更は計画レビューを必須化
- **`--strict` で dual review** (Reviewer A=Opus xhigh + B=Sonnet high) を同一メッセージ内並列起動、structured JSON を merge
- **agent ごとに memory directory** (`~/.claude/pev/{TASK_ID}/`) を持ち、retry や次セッションへの引き継ぎが durable

### v2.x → v3.0 Migration

v2.x の `/pev <task>` で `permissionMode=auto` での挙動を 保ちたい場合: `/pev <task> --with-plan` で v2.x 互換 (= Triage を skip して必ず Plan を起動)。 詳細は [CHANGELOG v3.0](./CHANGELOG.md#300---2026-05-12)。

## Quick start

### A) 個人 install (user scope、 全 project で使える)

```bash
# 1) Plugin Marketplace 経由でインストール (v2.1+ 推奨)
claude plugin marketplace add myksyut/pev-harness
claude plugin install pev-harness@pev-harness

# 2) project に bootstrap (v1.9+、 1 コマンドで team-conventions.md + .gitignore + 言語検知)
cd <your-project>
claude
> /pev-harness:pev-init

# 3) 最初のタスクを実行
> /pev-harness:pev "Add a /healthz endpoint that returns {status: 'ok'}"
```

### B) Team 共有 install (project scope、 v2.1.5+)

team 全員が同じ project で同じ pev-harness version を使うことを保証したい場合:

```bash
cd <your-project>
claude plugin marketplace add myksyut/pev-harness
claude plugin install pev-harness@pev-harness --scope project
# → <project>/.claude/settings.json に extraKnownMarketplaces + enabledPlugins が書き込まれる
git add .claude/settings.json && git commit -m "chore: adopt pev-harness team-wide"
```

teammate は project clone → `claude` 起動で trust prompt → 同意で auto install + enable。 詳細は [ONBOARDING §1.2](./ONBOARDING.md#12-project-scope-install-team-共有-v215-推奨)。

### C) セッション単位の試用 (`--plugin-dir`)

```bash
git clone https://github.com/myksyut/pev-harness.git
claude --plugin-dir ./pev-harness
> /pev-harness:pev-init
> /pev-harness:pev "..."
```

v2.0 以前の手動 clone install (`~/.claude/plugins/repos/myksyut/`) もそのまま動く。

`/pev-init --dry-run` で「実行予定 file list + 言語検知結果」を見てから実行する習慣を推奨。

## Optional integrations

pev-harness の core 機能 (PEV pipeline / Gate A/B / dual-review / external-reviewer) は単体で動きますが、 一部 skill は **別 plugin に依存** します。 使う機能だけ install してください。

### Linear sync (issue/project 連携、 `pev-linear-sync` / `linear-project-workflow` / `linear-project-tracker` 用)

```bash
# Anthropic 公式 marketplace から Linear plugin を install
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install linear@claude-plugins-official
# 初回起動時に OAuth で Linear workspace に接続 (Linear hosted MCP: https://mcp.linear.app/mcp)
```

install しないと `mcp__plugin_linear_linear__*` tool が解決できず、 上記 3 skill は no-op になります。 Linear 連携を使わないなら skip 可。

### Playwright E2E (`pev-e2e-verify` / `/pev-verify-e2e` / `/pev-init-e2e` 用)

`examples/sample-project/.mcp.json` がテンプレ。 各 project の `.mcp.json` に下記を追記:

```json
{ "mcpServers": { "playwright-test": { "command": "npx", "args": ["playwright", "run-test-mcp-server"] } } }
```

`/pev-init-e2e` が `.mcp.json` / `.claude/agents/playwright-test-*.md` を auto 生成するので、 普段は手動編集不要。

### Codex CLI (`pev-external-reviewer` / `--reviewer dual-codex` 用)

```bash
# OpenAI Codex CLI install (公式: https://github.com/openai/codex)
brew install openai/tap/codex
codex auth login
```

`/pev-init-codex` で project 側 wire-up 完了。

## Required initial-turn prompt structure

```text
Goal: 達成したいこと
Constraints: やってはいけないこと・依存制約
Acceptance Criteria: 成功の判定方法
Files: 既知の関連パス (任意)
```

不足要素があれば、planner はコードを1行も読まずに**まず質問返し**する。Opus 4.8 は literal instruction-following が強いので (4.8 で更に強化)、暗黙の文脈には頼らない。

## Components

| 種類 | 内容 |
|---|---|
| **agents** (3) | planner / executor / verifier |
| **skills** (18) | pev-pipeline, pev-spec-template, pev-task-budget, pev-focus-mode, pev-recap, pev-subagent-memory, pev-dual-review, pev-team-conventions, pev-test-design, pev-e2e-verify, pev-bootstrap-playwright, pev-bootstrap-project (v1.9), **pev-bootstrap-codex** (v2.0), **pev-external-reviewer** (v2.0), pev-linear-sync, linear-project-workflow, linear-project-tracker, **empirical-prompt-tuning** (v2.1) |
| **commands** (9) | `/pev`, `/pev-plan`, `/pev-execute`, `/pev-verify`, `/pev-verify-e2e`, `/pev-status`, `/pev-init-e2e`, `/pev-init` (v1.9), **`/pev-init-codex`** (v2.0) |
| **hooks** (3) | PreToolUse (destructive cmd block) / Stop (recap auto-append) / SessionStart (task resume) |
| **rules** (3) | `pev-conventions.md` (Gate respect 等) / `native-prompting.md` (禁止フレーズリスト + 4.8 scoped-verify 例外) / `error-patterns.md` (エラー推測 catalog) |

## Documentation

- [SPEC.md](./SPEC.md) — 完全仕様 (12 章 + ADR 5 件)
- [ONBOARDING.md](./ONBOARDING.md) — Installation, troubleshooting, FAQ
- [CHANGELOG.md](./CHANGELOG.md) — version history
- [CONTRIBUTING.md](./CONTRIBUTING.md) — How to contribute
- [SECURITY.md](./SECURITY.md) — Vulnerability disclosure policy
- [examples/](./examples/) — Sample plan.md / verify.json / dog food evidence

## Design philosophy

5 つの原則 (SPEC.md §1):

| | |
|---|---|
| **P1** | Single source of truth — 1 phase に 1 agent / 1 skill |
| **P2** | 4.X-native — `xhigh` / adaptive thinking / task budget / auto mode 前提 |
| **P3** | No backwards compat — Claude Code v2.1.111+ 必須、4.6 以前と互換しない |
| **P4** | Convention over configuration — settings.json デフォルトで動く |
| **P5** | Hook-driven verification — 検証は prompt ではなく hook で強制 |

特に **P5 が dog food で証明済み**: v0.5 で planner が `permissionMode=default` を自主判断で override したが、v0.6 で rules / agent / command の 3 層で Gate boundary を縛って完全解消した。

## What this harness does NOT do

- 言語別ヘルパーの追加 (プロジェクト側の tooling を使う)
- 自動 git commit (人間が境界を決める)
- 自動フォーマット (プロジェクト側の formatter)
- 50 個の specialized agent (ここでは agent 3 個でミニマルに完結)

## Roadmap

| Version | スコープ | Status |
|---|---|---|
| v0.1-v0.6 | 機能開発 (Plan/Execute/Verify pipeline 完成) | ✅ released |
| v1.0 | Rollout package (ONBOARDING / ROLLOUT-CHECKLIST / FEEDBACK-TEMPLATE) | ✅ released |
| v1.1 | OSS 化準備 (LICENSE / SECURITY / templates) | ✅ released |
| v1.2-v1.3 | Linear integration + hardening (28 dog food findings) | ✅ released |
| v1.4-v1.5 | E2E verification (Playwright) + QA technique integration | ✅ released |
| v1.6-v1.7 | dog food findings reflection + CLAUDE.md 開発者向け再定義 | ✅ released |
| v1.8 | v1.3 + v1.7.1 dog food findings reflection (9 件) | ✅ released |
| v1.9 | `/pev-init` project bootstrap command (言語検知 + auto-populate) | ✅ released |
| **v2.0** | **External reviewer (OpenAI Codex CLI) integration** — dual-codex mode で真の model diversity | ✅ released |
| v2.1+ | Gemini CLI 対応 / planner-executor も外部 model 切替可 | [Issue #9](https://github.com/myksyut/pev-harness/issues/9) continuation |

## Contributing

Bug report / feature request は [Issues](https://github.com/myksyut/pev-harness/issues) で。質問は [Discussions](https://github.com/myksyut/pev-harness/discussions) で。

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。Security 脆弱性は **SECURITY.md** の手順で private に。

## License

MIT — see [LICENSE](./LICENSE).

---

> **Note for users**: pev-harness は **trusted developer の local 環境** で動作する開発支援 plugin として設計されています。 SaaS / 共有環境での運用には追加の sandbox / isolation が必要です。詳しくは [SECURITY.md](./SECURITY.md) の threat model 参照。
