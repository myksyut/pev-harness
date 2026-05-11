---
name: pev-team-conventions
description: プロジェクトルートの team-conventions.md を読み込み、planner/executor のpromptに自動注入。チーム規約をsource of truth化
---

# pev-team-conventions

`team-conventions.md` を「チームのcoding規約のsingle source of truth」とし、PEV pipelineが自動でpromptに注入する仕組み。

## When to Use

- planner / executor 起動時 (自動)
- 新しいチームメンバーがpluginを導入した時
- 既存プロジェクトに pev-harness を導入する時

## How It Works

### team-conventions.md の場所と構造

プロジェクトルート直下に `team-conventions.md` を置く:

```markdown
# Team Conventions

## Language & Stack
- TypeScript strict mode必須
- Node.js >=20
- Package manager: pnpm

## Code style
- Prefer named exports over default exports
- File naming: kebab-case
- Test files: *.test.ts (vitest)

## Commit policy
- Conventional commits (feat:/fix:/chore:/...)
- 1 file change = 1 commit (small PR culture)

## Review rubric (--strict)
- Security: OWASP Top 10
- Performance: avoid N+1 queries in src/api/*
- Accessibility: WCAG 2.1 AA for src/components/*

## Forbidden
- console.log in production code (use logger)
- any type without // FIXME comment
```

### 注入方法

planner / executor が起動する際、このskillがpromptの先頭に:

```
# Team Conventions (from team-conventions.md)
<file contents>

# Your task
<original prompt>
```

を組み立てる。これにより agent は常に規約を意識した出力を生成する。

### セクション別の利用

| セクション | 主に利用するagent |
|---|---|
| Language & Stack | planner (依存判断)、executor (実装) |
| Code style | executor |
| Commit policy | executor (execute.logの提案文) |
| Review rubric | verifier (pev-dual-review使用時) |
| Forbidden | planner (避ける) / verifier (検出) |

### 不在時の挙動

`team-conventions.md` が存在しない場合:

- 通知メッセージのみ: `[PEV] No team-conventions.md found. Operating without team rules.`
- pipeline はそのまま継続
- 一般的なベストプラクティスのみで動作

### local override

個人ごとに上書きしたい場合:

```bash
~/.claude/pev/team-conventions.local.md
```

これがあれば team-conventions.md より優先される (ただし非推奨、チーム不整合のリスク)。

## Examples

### 規約ありプロジェクトでの動作

team-conventions.md:
```markdown
## Forbidden
- any type without // FIXME
```

実行:
```
/pev "Parse user input as JSON"
```

planner の plan.md に自動的に:
```
## Constraints (from team-conventions.md)
- No `any` type without // FIXME comment

## File-level changes
- [ ] src/parser.ts: Parse with explicit type `Record<string, unknown>` (not any)
```

### Review rubric の活用

team-conventions.md:
```markdown
## Review rubric (--strict)
- All API endpoints must have OpenAPI annotation
```

`/pev --strict` 時、verifier は dual-reviewのrubricに自動で:
```
| API endpoint OpenAPI | All public endpoints have @openapi annotation |
```
を追加してチェックする。

## メンテナンス指針

- team-conventions.md はPRレビューに含める
- 規約変更時は CHANGELOG に記録
- 過度に長くしない (1ページ以内目安)
- 「やるな」より「こうしろ」を書く (positive instruction)

## 注意点

- プロジェクト固有ルールはここに集約する (skill側にhardcodeしない)
- バイナリ的な好み (semicolon有無等) は formatter で強制し、conventions には書かない
- secret / API keyを書かない (gitに入る前提)
