---
description: Bootstrap pev-harness in the current project (one-time setup) — generates team-conventions.md / .gitignore / optional files with language detection
---

# /pev-init

新規プロジェクトに pev-harness を導入する **one-time setup** コマンド。 言語/構成 検知 (Node / Python / Go / Rust / Ruby + E2E config) で `team-conventions.md` の `## Verification commands` を auto-populate、 `.gitignore` に `artifacts/` を追記、 オプションで `.linear-config.yml.example` / `.claude/settings.local.json` / 個人 override skeleton を AskUserQuestion 経由で対話的に生成する。

## Usage

```text
/pev-init                # 通常 init (interactive prompts あり)
/pev-init --dry-run      # 「実行予定 file list + 検知結果 + 質問 preview」を出力、 実 I/O なし
/pev-init --force        # interactive skip + idempotent skip も bypass、 既存 file は検知結果で上書き、 optional 全 yes default (CI / 自動化用)
```

**`--force` の挙動 (v1.9 dog food finding F3 反映)**: 既存 `team-conventions.md` が v1.8+ template と一致している場合でも、 通常モードでは idempotent skip するが、 `--force` ではこれを bypass して **検知結果で上書き** する。 言語検知結果が変わった (e.g., package manager が npm → pnpm に変わった、 Lint command を追加した) ケースで再生成したい場合の formal channel。

## フロー (pev-bootstrap-project skill 起動)

1. **Preflight**: git root 解決、 既存 `team-conventions.md` / `.gitignore` / `.linear-config.yml` 検出、 v1.8+ template ならば idempotent skip
2. **言語/構成 検知**: `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `Gemfile` / `playwright.config.*` / `cypress.config.*` を順に探索、 検知結果で Verification commands 4 項目を決定 (検知不能は `未設定`)
3. **`team-conventions.md` populate**: `examples/team-conventions.example.md` を base に Language & Stack + Verification commands を埋める。 既存 file があれば AskUserQuestion で「上書き / merge / skip」分岐
4. **`.gitignore`**: `artifacts/` を append (idempotent grep -Fxq で重複防止)
5. **Optional file (interactive)**: AskUserQuestion で `.linear-config.yml.example` / `.claude/settings.local.json` / `~/.claude/pev/team-conventions.local.md` のうち欲しいものを multi-select
6. **Dry-run preview** (`--dry-run` 時): Step 3-5 で確定した予定を stdout 出力して exit
7. **File write + summary**: 通常モードは file を書き込み、 「Created file list + Next steps (`/pev <task>` を試す等)」 を stdout

詳細は [`skills/pev-bootstrap-project/SKILL.md`](../skills/pev-bootstrap-project/SKILL.md)。

## 既に setup 済の場合

skill が Preflight で detect し、 `team-conventions.md` が v1.8+ template かつ `.gitignore` に `artifacts/` がある状態なら early exit + 「既に init 済」message。 incremental に missing 項目のみ補完する path も提供。

## 完了後

```text
/pev "Your first task"            # PEV pipeline を試す
/pev-init-e2e                     # (任意) Playwright もセットアップ
```

`git add` / `git commit` は skill が自動実行しない。 user が中身を確認してから commit する想定。

## Notes

- `--dry-run` は destructive 操作 (新規 file 書き込み / `.gitignore` 改変) の preview として推奨。 fresh project でも 1 度試して内容を確認する習慣を
- `--force` は CI / 自動化向け。 通常 user は interactive で生成内容を確認する方が良い
- pev-bootstrap-playwright (Playwright 専用 init) との関係: `/pev-init` は project 全体、 `/pev-init-e2e` は E2E 専用、 並列の sibling 関係
