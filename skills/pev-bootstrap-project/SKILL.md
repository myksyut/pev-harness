---
name: pev-bootstrap-project
description: pev-harness を使うプロジェクトに必要な初期 file を 1 操作で生成する skill。 言語/構成 検知 (Node/Python/Go/Rust + E2E config) で team-conventions.md の Verification commands を auto-populate、 .gitignore に .pev-artifacts/ を追記、 オプションで .linear-config / settings.local / 個人 override skeleton を AskUserQuestion 経由で対話的に生成。 既存 file 衝突は「上書き / merge / skip」分岐。
disable-model-invocation: true
---

# pev-bootstrap-project

`/pev-init` で呼ばれる **one-time setup** skill。 v1.4 で確立した `pev-bootstrap-playwright` pattern を project 全体に拡張した sibling。 新規 project に pev-harness を導入する手順を 1 操作で完結させる。

## When to Use

起動すべき場面:

- `/pev-init` が user に呼ばれた時
- 新規 project に pev-harness を初めて導入する時
- 既存 project で `team-conventions.md` が古い template だと判定された時 (`pev-team-conventions` skill が template 不整合を検出 → 提案)

起動すべきでない場面:

- 既に `team-conventions.md` が v1.8+ template (= `## Verification commands` section あり) で揃っており、 `.gitignore` に `.pev-artifacts/` も追記済の場合 (Preflight が detect、 idempotent skip)

## CLI flags

- `--dry-run`: 「実行予定 file list + 検知結果 + 質問 preview」を stdout 出力して exit、 実 I/O なし
- `--force`: interactive prompts を skip、 既存 file は上書き default (CI / 自動化用)

## Bootstrap Steps

### Step 1: Preflight check

```bash
# git root 確認 (絶対パス決定)
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# 既存 file 検出
test -f "$PROJECT_ROOT/team-conventions.md" && EXISTING_TC=true
test -f "$PROJECT_ROOT/.gitignore"          && EXISTING_GI=true
test -f "$PROJECT_ROOT/.linear-config.yml"  && EXISTING_LC=true

# v1.8 必須 section の有無判定 (existing template の version 推定)
grep -q '^## Verification commands' "$PROJECT_ROOT/team-conventions.md" 2>/dev/null && TC_V18=true
```

idempotent: 全 target が v1.8+ template かつ .pev-artifacts/ 追記済なら early exit + 「既に init 済」message。

**`--force` の override (v1.9 dog food finding F3)**: `--force` flag は idempotent skip を **bypass** する。 既に v1.8+ template でも検知結果で **上書き**する (= 言語検知結果が変わった可能性がある時、 user が明示的に再生成したいケースを満たす)。 通常モードでのみ idempotent skip が適用される。

### Step 2: 言語/構成 検知

検知 source priority (上から順、 最初に hit したものを採用):

| Source file | 言語 | 検知される command |
|---|---|---|
| `package.json` (Node.js) | JS / TS | `scripts.test` / `scripts.lint` / `scripts.typecheck` を json から read |
| `pyproject.toml` (Python) | Python | `tool.pytest` / `tool.ruff` / `tool.mypy` の存在で推定 (`pytest` / `ruff check .` / `mypy .`) |
| `go.mod` (Go) | Go | hardcoded: `go test ./...` / `go vet ./...` (typecheck は `vet` で兼用、 lint は `未設定` 既定) |
| `Cargo.toml` (Rust) | Rust | hardcoded: `cargo test` / `cargo clippy` / `cargo check` |
| `Gemfile` (Ruby) | Ruby | `bundle exec rspec` (or `bundle exec rake test`) / `bundle exec rubocop` / `未設定` |
| (なし) | unknown | 全項目 `未設定` で fill |

E2E は **独立 axis**:

- `playwright.config.{ts,js,mjs,cjs}` → `E2E test: npx playwright test`
- `cypress.config.{ts,js}` → `E2E test: npx cypress run`
- なし → `E2E test: 未設定`

検知結果は internal record として保持し、 Step 3 で `team-conventions.md` の `## Verification commands` に埋める。

### Step 3: team-conventions.md skeleton populate

base template: `examples/team-conventions.example.md` (v1.9+ の言語非依存 skeleton)。

埋める箇所:

- `## Language & Stack`: 検知言語 + runtime (e.g., `Node.js` → `Language: JavaScript / TypeScript` / `Runtime: Node.js`)、 package manager は `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` の存在で推定
- `## Verification commands`: Step 2 の検知結果を 4 項目に展開、 検知できなかった項目は `未設定`

**既存 file 衝突分岐** (EXISTING_TC=true の時):

`AskUserQuestion` で 3 択を user に提示:

```text
Q: 既存 team-conventions.md が見つかりました。 どうしますか?
- 上書き: 検知結果で新規 skeleton に置き換え (既存内容は失われる)
- merge:  ## Verification commands section のみ追加/更新、 他 section は維持
- skip:   既存 file を維持 (推奨: 既に v1.8+ template の場合)
```

`--force` 時は確認なしで「上書き」既定。 `--dry-run` 時は質問せず「上書きを仮定」と仮プレビュー。

### Step 4: .gitignore に `.pev-artifacts/` 追記

```bash
# 既存 .gitignore に ".pev-artifacts/" を grep -F で完全一致検索
# hit すれば skip、 なければ append
if ! grep -Fxq '.pev-artifacts/' "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
  printf '.pev-artifacts/\n' >> "$PROJECT_ROOT/.gitignore"
fi
```

`.gitignore` 自体が無ければ新規作成 (`.pev-artifacts/` 1 行のみ)。 `--dry-run` 時は実行せず予定 line だけ表示。

### Step 5: Optional file の interactive prompts

`AskUserQuestion` で 3 項目を multi-select として user に提示:

```text
Q: 追加で生成しますか? (multi-select)
- [x] .linear-config.yml.example   (Linear 連携を将来使う予定)
- [ ] .claude/settings.local.json  (permissionMode を auto に切替したい)
- [ ] ~/.claude/pev/team-conventions.local.md  (個人 override 雛形、 global)
```

選択された項目のみ生成:

- **`.linear-config.yml.example`**: `examples/sample-project/.linear-config.yml.example` を project root に copy
- **`.claude/settings.local.json`**: 既存があれば skip、 新規なら `{ "permissionMode": "default" }` 雛形 (default のままだが、 user が編集する起点として)
- **`~/.claude/pev/team-conventions.local.md`**: global path、 既存があれば skip、 新規なら "# Personal additions to team conventions\n\n## Forbidden (personal)\n- ...\n" の skeleton

`--force` 時は全項目 yes default。 `--dry-run` 時は質問せず 「全項目 yes 仮定」 でプレビュー。

### Step 6: Dry-run preview

`--dry-run` 時、 Step 3-5 で確定した「これを書く予定」を **assistant の最終応答テキスト (= subprocess の stdout)** として以下フォーマットで出力する。 `--print` mode で動かす場合、 user は **このテキストそのもの** を stdout で受け取るため、 自然言語 summary だけで終わらせず必ず full block を出力する (v1.9 dog food finding F1)。

```text
[pev-init --dry-run]

Detected:
  Language: JavaScript (Node.js, npm)
  Unit test: npm test
  E2E test:  npx playwright test
  Lint:      未設定
  Typecheck: 未設定

Planned writes:
  + team-conventions.md   (new, ~40 lines)
  + .gitignore            (append: .pev-artifacts/)
  + .linear-config.yml.example (copy from plugin examples/)

Skipped:
  - .claude/settings.local.json (not selected)
  - ~/.claude/pev/team-conventions.local.md (not selected)

Run without --dry-run to apply.
```

実 I/O は一切行わない。 「dry-run preview を出力した」 という summary 文だけで終えるのは **規約違反** (subprocess の内部完結に陥ると user に何も届かない)。

### Step 7: File write + summary

通常モード時、 Step 3-5 の確定内容を file に書き込み、 結果サマリを **assistant 最終応答テキスト (= subprocess の stdout)** として以下フォーマットで出力する。 Step 6 と同様、 `--print` mode 経由で user が受け取るのは **この block そのもの** なので、 「生成 file list は既に出力済み」 のような自然言語 summary に逃げず full block を毎回出す (v1.9 dog food finding F1)。

```text
[pev-init] complete

Created:
  team-conventions.md      (Language: JavaScript, Unit: npm test, E2E: npx playwright test)
  .gitignore               (appended: .pev-artifacts/)
  .linear-config.yml.example
  .claude/settings.local.json

Skipped:
  ~/.claude/pev/team-conventions.local.md (not selected)

Next steps:
  1. team-conventions.md を編集してチーム固有のルールを追加
  2. /pev "Your first task" で pipeline を試す
  3. (Linear 連携する場合) .linear-config.yml.example を .linear-config.yml にリネームして workspace/team.id を埋める
```

`git add` / `git commit` は **行わない** (user の commit boundary を奪わない、 既存 `/pev-init --e2e` skill と同方針)。

## Examples

### 新規 Node.js project に init

```bash
cd ~/work/my-new-project
npm init -y
npm install -D vitest

claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init'
```

期待出力:

- `team-conventions.md`: Language=JavaScript / Unit test=`npm test` / 他 3 項目=未設定
- `.gitignore`: `.pev-artifacts/` が新規追記 (or .gitignore 自体が新規作成)
- AskUserQuestion で optional 3 項目を user に問う

### dry-run で内容確認

```bash
claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init --dry-run'
```

→ I/O なしで「予定 file list + 検知結果」のみ出力。

### CI / 自動化 (--force)

```bash
claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init --force'
```

→ interactive prompts skip、 既存 file は上書き、 optional file は全 yes default で生成。

## Related

- [`pev-bootstrap-playwright`](../pev-bootstrap-playwright/SKILL.md) — Playwright 専用の sibling bootstrap
- [`pev-team-conventions`](../pev-team-conventions/SKILL.md) — 生成された `team-conventions.md` を planner/executor に inject
- `examples/team-conventions.example.md` — Step 3 で base に使う言語非依存 template
- `examples/sample-project/.linear-config.yml.example` — Step 5 で copy 元

## Notes

- skill 自体は **idempotent** に設計: 同じ project で何度 invoke しても、 既に v1.8+ template なら no-op (Preflight が早期 exit)
- `--force` は user の **明示的な override channel** であり、 skill が判断して付与してはならない (`rules/pev-conventions.md` "Gate respect" と同思想)
- `team-conventions.md` の中身 hard-code は禁止: 言語非依存 skeleton を `examples/team-conventions.example.md` に集約、 skill は populate のみ担当 (Single source of truth)
- 検知できない言語 / 構成は強制せず `未設定` を書く (= verifier が短絡判定して PASS、 v1.8 #19 と整合)
