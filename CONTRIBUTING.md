# Contributing to pev-harness

社内 / 信頼できる開発者向けの contribution guide。

## 哲学

- **ミニマル維持**: 新しい agent / skill / command の追加は慎重に
- **4.7-native**: 4.6時代のscaffolding (`step by step`, `double-check`等) を絶対書かない
- **設計判断は ADR**: SPEC.md Section 12 に追記

## Branch / Commit ポリシー

- branch名: `feat/<short-description>` / `fix/<short-description>` / `docs/<...>`
- conventional commits: `feat:` / `fix:` / `chore:` / `docs:` / `test:` / `refactor:`
- 1 PR = 1 logical change

## 新しい component を追加する時

### 新しい agent

`agents/<name>.md` を作成。frontmatter:

```yaml
---
name: <name>
description: <一行説明>
model: opus | sonnet | haiku
tools: <カンマ区切り>
---
```

- `model` 指定は必須 (短縮形 `opus` / `sonnet` でOK、Claude Codeが最新版に解決)
- `tools` は必要最小限のみ
- prompt部に**禁止フレーズ**を含めない (`rules/4.7-native.md` 参照)

### 新しい skill

`skills/<skill-name>/SKILL.md` を作成。必須セクション:

1. frontmatter (`name`, `description`)
2. `## When to Use`
3. `## How It Works`
4. `## Examples`

skill ディレクトリ名 = skill名。これが `/<plugin>:<skill>` の `<skill>` 部分になる。

### 新しい command

`commands/<command-name>.md` を作成。frontmatter:

```yaml
---
description: <一行説明>
---
```

中身は Markdown。Claude Code が読んで実行する想定。Bashブロックを含めても動く。

## Lint と CI

PR を出す前に:

```bash
# markdownlint (もし手元で動かしたければ)
npx markdownlint-cli '**/*.md' --ignore node_modules --ignore artifacts

# JSON schema validation
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json'))"
node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json'))"
node -e "JSON.parse(require('fs').readFileSync('settings.json'))"
```

CI が同じことを自動で走らせる。

## SPEC.md の更新

設計に影響する変更は `SPEC.md` も同じPRで更新する:

- 新しい component を追加 → 該当セクション (§7 skills 等) 更新
- 設計判断が伴う変更 → §12 ADR-XXX として追記
- ロードマップ (§11) を更新

## CHANGELOG.md の更新

ユーザーに見える変更は `CHANGELOG.md` の `## [Unreleased]` に追記。

## Issue / PR の書き方

Issue:
- Title: `[Type] <短い説明>` (Type: feat / fix / docs / chore)
- Body: 何を / なぜ / 想定スコープ / 関連 SPEC.md セクション

PR:
- Title: conventional commit style
- Body:
  - **What**: この PR で何が変わるか
  - **Why**: なぜ必要か (Issue link)
  - **Test plan**: dog food手順、観察すべきポイント
  - **Spec changes**: SPEC.md / CHANGELOG.md の更新有無

## 禁止事項

- `artifacts/` をコミット (gitignore済みだが、強制 add は禁止)
- secrets/credentials を含める (`.gitignore` で `*.env` 追加検討)
- 4.6時代のscaffoldingフレーズ ("step by step", "double-check"等)
- 言語別 tooling の bundle (Python helper, npm script等)
- 後方互換性のための分岐コード

## 質問

- Slack: #pev-harness (社内)
- GitHub Issues: 社内利用のため private。slackで簡単な質問、まとまったらIssue化
