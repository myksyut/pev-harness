---
name: pev-team-conventions
description: team-conventions.md と ~/.claude/pev/team-conventions.local.md を読み込んで planner/executor の prompt に自動注入。プロジェクト規約を agent動作の Single Source of Truth にする
---

# pev-team-conventions

team-conventions.md を**チーム規約の Source of Truth** とし、PEV pipeline が起動時に自動でpromptに注入する仕組み。dog food で「planner が team-conventions.md を自然に参照する」挙動を確認済み (v0.1, v0.2)。v0.5 はこれを明示的な protocol として整える。

## When to Use

- planner / executor 起動時 (自動、毎回)
- 新しいチームメンバーが pev-harness を導入した時
- 既存プロジェクトに pev-harness を導入する時

## Injection 規約 (v0.5 protocol)

### 読み込み優先順位

agent (planner / executor) は起動時に**この順序で**規約ファイルを探す:

1. `~/.claude/pev/team-conventions.local.md` (個人 override、最優先)
2. `<project_root>/team-conventions.md` (チーム共有)
3. なし (デフォルト動作)

`<project_root>` は `git rev-parse --show-toplevel` で決まる。git管理外なら `cwd`。

複数見つかった場合、**両方を**読み込み、`local.md` のセクションが project側 と被ったら local 優先。

### Injection 位置

agent prompt の **冒頭**、`# Your task` の直前に以下フォーマットで挿入:

```text
# Team Conventions (auto-injected by pev-team-conventions skill)

<team-conventions.local.md 内容 — もしあれば>

<team-conventions.md 内容 — もしあれば>

---

# Your task
<本来の planner / executor 入力>
```

不在時:

```text
# Team Conventions
(none found — operating on PEV defaults)

---

# Your task
...
```

### Section ごとの利用先

team-conventions.md の構造化された section を、PEV pipeline 内で**どこに反映するか**:

| Section | 反映先 |
|---|---|
| `## Language & Stack` | planner: 依存判断、Constraints セクションの基礎 |
| `## Code style` | executor: 実装時の規約 |
| `## Commit policy` | executor: execute.log の「proposed commit message」フォーマット |
| `## Review rubric` | verifier (--strict時): rubric の追加項目として |
| `## Forbidden` | planner (避ける) + verifier (検出して fail) |
| `## Files to never touch` | planner + executor: 該当ファイル変更を refuse |

## planner / executor 側の責務

各 agent は **自分で** team-conventions を読む。skill の役割は「**読み込み protocol を規約として固定**」し、各 agent が同じ順序・同じ位置で読むよう保証すること。

具体的には:

1. agent prompt 内に `## Team conventions loading` セクションを置く (planner.md / executor.md 参照)
2. agent は起動直後、上記優先順位でファイルを探して読む
3. 読み込んだ内容を Constraints / Code style / etc. に**統合**する
4. プロンプト出力 (plan.md, execute.log) に**どの規約を適用したか**を明示する (verifier や human reviewer のため)

## Examples

### Project でのセットアップ

```bash
# 既存プロジェクトに pev-harness を導入する時
cd <your-project>
cp ~/pev-harness/examples/team-conventions.example.md ./team-conventions.md
# → 内容をプロジェクト固有に編集
git add team-conventions.md
git commit -m "chore: add team-conventions for pev-harness"
```

### 個人 override

```bash
# 「自分のtaskでは追加で X も守りたい」のような個人ルール
cat > ~/.claude/pev/team-conventions.local.md << 'EOF'
# Personal additions to team conventions

## Forbidden (personal)
- TODO comments without an assignee
- Function bodies over 50 lines (extract helper)
EOF
```

### dog food evidence (v0.1, v0.2 ともに確認済み)

planner が `team-conventions.md` の `## Language & Stack` を読んで plan.md の `## Constraints` に自動反映:

```markdown
## Constraints
- JavaScript ESM, Node >= 20      ← team-conventions から
- Named exports only              ← team-conventions から
- 2-space indent, semicolons      ← team-conventions から
- No console.log                  ← team-conventions から
- No TypeScript migration         ← team-conventions から
```

v0.5 では、この自然発生していた挙動が **protocol として規約化** されたので、各 agent が同じ順序で読み、同じ書式で plan.md / execute.log に反映するようになる。

## メンテナンス指針

- team-conventions.md は PR レビュー対象に含める
- 規約変更時は CHANGELOG (プロジェクト側) に記録
- 過度に長くしない (1ページ以内目安)
- 「やるな」より「こうしろ」を書く (positive instruction)
- 個人 override (`~/.claude/pev/team-conventions.local.md`) はチーム不整合のリスクなので、長期化するなら project 側に昇格すべき

## 注意点

- プロジェクト固有ルールはここに集約する (skill / agent prompt にhardcodeしない)
- バイナリ的な好み (semicolon 有無等) は formatter で強制し、conventions には書かない
- secret / API key を書かない (git に入る前提)
- 個人 override は `~/.claude/pev/team-conventions.local.md` 固定パス (他のパスは読まない、規約をシンプルに)
- pev-team-conventions skill 自体には team-conventions.md の中身を hard-code しない (project-agnostic を保つ)
