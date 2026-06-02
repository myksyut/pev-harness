# Onboarding pev-harness

社内チーム展開向けの導入ガイド。v1.0 でロールアウト準備完了。

## 0. Pre-flight check

導入前に以下を確認:

```bash
# Claude Code のバージョン (≥ v2.1.156 必須 — Opus 4.8 pin + <2.1.156 の tool-use bug 回避)
claude --version

# pev-harness のリポジトリへアクセスできるか (private repo)
gh repo view myksyut/pev-harness > /dev/null && echo OK || echo "ACCESS DENIED"
```

アクセスがない場合: メンテナに連絡して GitHub アカウントを repo collaborator に追加してもらう。

## 1. 個人ごとのインストール

```bash
# A. Plugin Marketplace 経由 (v2.1+ 推奨)
claude plugin marketplace add myksyut/pev-harness
claude plugin install pev-harness@pev-harness
# Claude Code 再起動不要、 install 完了で自動認識

# B. 手動 clone (v2.0 以前の方式、 現在も動く)
mkdir -p ~/.claude/plugins/repos/myksyut
cd ~/.claude/plugins/repos/myksyut
git clone https://github.com/myksyut/pev-harness.git
# Claude Code 再起動で自動認識

# C. 一時利用 (--plugin-dir フラグ、セッション単位)
cd ~/work
git clone https://github.com/myksyut/pev-harness.git
claude --plugin-dir ./pev-harness
```

A は **v2.1 以降の正規方法** (`.claude-plugin/marketplace.json` を導入済み)。 `pev-harness@pev-harness` は `<plugin-name>@<marketplace-name>` 形式で、 1-repo パターンのため両者とも `pev-harness` になる。

B は historic な手動 clone 方式。 既に B で導入済みのチームは `git pull` で v2.1+ に上げれば marketplace.json が同梱されるが、 install 経路を A に変える必要はない。

C は検証/お試し向け。 チーム展開では **A または B を推奨**。

## 1.2. Project scope install (team 共有、 v2.1.5+ 推奨)

§1 の A/B/C は全て **user scope** (個人 + 全 project) の install。 「チーム全員が同じ project で同じ pev-harness version を使う」 ことを保証したい場合は **project scope** で commit する選択肢がある (公式 [Configure team marketplaces](https://code.claude.com/docs/en/discover-plugins.md#configure-team-marketplaces) 仕様)。

### Pattern P1: `.claude/settings.json` に declare (commit して team 共有)

```json
// <project>/.claude/settings.json
{
  "extraKnownMarketplaces": {
    "pev-harness": {
      "source": {
        "source": "github",
        "repo": "myksyut/pev-harness"
      }
    }
  },
  "enabledPlugins": {
    "pev-harness@pev-harness": true
  }
}
```

これを git commit すると、 teammate が project clone → `claude` 起動 → Claude Code が「この repo の marketplace を trust するか」 と prompt → trust すれば auto install + enable される。 trust は 1 回だけ確認、 以降は repo trust 状態を保持。

### Pattern P2: CLI 1 発 (同等の JSON を生成)

```bash
cd <your-project>
claude plugin marketplace add myksyut/pev-harness
claude plugin install pev-harness@pev-harness --scope project
```

`--scope project` flag で `.claude/settings.json` に Pattern P1 と同じ JSON が書き込まれる。 commit すれば team に行き渡る。

### scope 3 種の比較

| Scope | 設定ファイル | git commit | 共有範囲 |
|---|---|---|---|
| **user** (§1 A の default) | `~/.claude/settings.json` | ❌ (個人) | 個人 / 全 project |
| **project** | `<project>/.claude/settings.json` | ✅ commit して team へ | project clone した teammate 全員 |
| **local** | `<project>/.claude/settings.local.json` | ❌ (`.gitignore` 推奨) | 個人 / 当該 project のみ |

### 使い分けの目安

- **個人で複数 project 横断的に使う** → user scope (§1 A)
- **特定 project で team 全員に強制したい** (version pin / 同期更新) → project scope (§1.2)
- **個人が特定 project でだけ試したい** → local scope (CLI で `--scope local`)

### 注意: trust prompt の体験

project scope の `extraKnownMarketplaces` は **trust prompt が初回起動で出る** (公式 docs 「When team members trust the repository folder, Claude Code prompts them to install these marketplaces and plugins」)。 teammate が CI / 非対話環境で実行する場合は、 user scope 経由の事前 install のほうがハマらない。 dev 環境 / interactive shell では project scope で十分。

## 1.5. 連携 plugin (使う機能だけ install)

pev-harness の core 機能は単体で動くが、 一部 skill は **別 plugin に依存** する。 使う機能だけ追加 install すること。

### Linear MCP (Linear sync 機能を使う場合は必須)

`skills/pev-linear-sync/`, `skills/linear-project-workflow/`, `skills/linear-project-tracker/` の 3 skill と `agents/verifier.md` の Linear push path は、 Anthropic 公式 Linear plugin の MCP server (`mcp__plugin_linear_linear__*` tool 群) に依存する。

```bash
# 個人ごとに 1 回 install
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install linear@claude-plugins-official
```

初回 Linear tool 呼び出し時に **OAuth dialog が起動**、 ブラウザで Linear workspace を承認すれば認証完了 (Linear hosted MCP: `https://mcp.linear.app/mcp` をラップする HTTP transport)。

確認方法:

```bash
# Claude Code 起動後、 deferred tool list に linear が surface するか
# (新 session で初回 prompt 時に自動 fetch される)
```

Linear 連携を使わないチームは skip 可。 install しないまま `/pev-harness:pev <Linear URL>` を実行すると、 Linear sync skill が「MCP unavailable」 で no-op し、 plain text の task として処理される。

### Playwright MCP (`/pev-init-e2e` を使う場合に project 側で setup)

`/pev-init-e2e` 実行時に `pev-bootstrap-playwright` skill が project の `.mcp.json` を auto 生成 (`examples/sample-project/.mcp.json` 参照)。 個人 install は不要、 project ごとの setup。

### Codex CLI (Execute phase の default executor / `--reviewer dual-codex` で使う場合)

```bash
brew install openai/tap/codex
codex auth login
```

`/pev-init-codex` で project 側の wire-up 完了。 個人ごとに 1 回 `codex auth login` が必要。

> **⚠️ データ送信ポリシー (v3.7.0+, Execute phase default = `codex`)**: v3.7.0 で **Execute phase の default executor が `codex` になりました**。 codex を setup 済の環境では、 実装時に **編集対象 file の内容が OpenAI (Codex) に送信される** のが既定挙動です (Claude 経由でも同様の送信は発生しますが、 team policy で「OpenAI への送信は禁止」 のケースあり)。 OpenAI への送信を避けたい場合は `.claude/settings.local.json` の env に `PEV_EXECUTOR_MODE=claude` を設定するか、 `/pev <task> --executor-mode=claude` で都度 override してください。 codex 未 setup の環境は自動で Claude native 実装に degrade します (= 何もしなければ従来どおり)。

## 2. プロジェクトへの導入

### 推奨 (v1.9+): `/pev-init` 1 コマンド

```bash
cd <your-project>
claude  # Claude Code 起動

# session 内で 1 行
/pev-harness:pev-init
```

`pev-bootstrap-project` skill が以下を自動実行する:

1. **言語/構成 検知** (`package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `Gemfile` / `playwright.config.*` / `cypress.config.*`)
2. **`team-conventions.md` 生成**: 検知結果で `## Language & Stack` と `## Verification commands` (v1.8 必須項目) を auto-populate
3. **`.gitignore` 更新**: `artifacts/` を append (idempotent、 既存があれば skip)
4. **任意の追加 file** (AskUserQuestion で対話的に選択):
   - `.linear-config.yml.example` (Linear 連携を将来使う場合)
   - `.claude/settings.local.json` (permissionMode 雛形)
   - `~/.claude/pev/team-conventions.local.md` (個人 override skeleton)

flags:

- `/pev-harness:pev-init --dry-run` で「実行予定 file list + 検知結果」を出力 (実 I/O なし、 内容確認用)
- `/pev-harness:pev-init --force` で interactive prompts skip + 既存上書き default (CI / 自動化用)

完了後、 user が中身を確認してから commit:

```bash
git add team-conventions.md .gitignore
git commit -m "chore: adopt pev-harness team conventions"
```

### 旧手順 (v1.8 以前 / 手動派の場合)

```bash
cd <your-project>
cp ~/pev-harness/examples/team-conventions.example.md ./team-conventions.md
# 内容をプロジェクト固有に編集 (Language / Verification commands / Code style 等)
echo "artifacts/" >> .gitignore
git add team-conventions.md .gitignore
git commit -m "chore: adopt pev-harness team conventions"
```

v1.9 以降は `/pev-init` が推奨。 旧手順は手動で全 step を回したい場合や、 `team-conventions.md` を 0 から自由に書きたい場合のみ。

## 3. 最初のタスク (dog food)

```text
/pev-harness:pev "Add a /healthz endpoint at src/server.ts that returns {status: 'ok'}.
Constraints: no new dependencies.
Acceptance: GET /healthz returns 200 + correct JSON, test added."
```

期待される動作 (`permissionMode=default` のとき、 **v3.0+**):

1. **Phase 0 (Triage、 v3.0+)**: triage agent が `artifacts/triage.json` を生成、 「Plan 必要か (plan_required) / Plan skip して直接 Execute (plan_skip)」 を 1 turn 以内で判定
2. **Plan 必要なら** (= 曖昧 spec / UI 拡張要素未明示 等): planner agent が `artifacts/plan.md` 生成。 grey zone は plan.md 冒頭の「## 確認質問」 で user に質問
3. **Gate A で停止** (default mode の場合、 = Plan が走った場合のみ)
4. ユーザーが plan.md を読み、問題なければ `/pev-harness:pev-execute`
5. executor が実装 (Mode A = plan ベース / Mode B = plan-less)、 Stop hook が verify を促す
6. ユーザーが `/pev-harness:pev-verify` を打つ、verifier が `verify.json` 生成
7. PASS なら完了。FAIL なら自動 retry (最大3回)

**v3.0 flag override**:

- `/pev-harness:pev <task> --with-plan`: Triage を skip して **必ず Plan を起動** (= v2.x 互換)
- `/pev-harness:pev <task> --no-plan`: Triage を skip して **必ず Plan-less Execute** (= 最短 path)

## 4. permissionMode の使い分け

| Mode | 用途 | Gate A挙動 |
|---|---|---|
| `default` (推奨) | 通常作業、レビュー必須タスク | plan.md出力後に停止 |
| `auto` | 信頼できる軽微タスク (linter修正、typo等) | スキップ、自動でexecute開始 |
| `plan` | 設計レビューのみ、見積もり | plan.md出力後に終了 |

切替方法:

- セッション内: `Shift+Tab`
- 個人デフォルト: `~/.claude/settings.local.json` に `"permissionMode": "auto"`
- プロジェクトデフォルト: `.claude/settings.json` (チーム共有)

## 5. --strict モード (リリース前)

```text
/pev-harness:pev "Refactor auth middleware to use JWT" --strict
```

`pev-dual-review` skill が起動し、Reviewer A (Opus xhigh) と B (Sonnet high) が並列で独立レビュー。両者 PASS で初めて NICE 判定。
詳細: `skills/pev-dual-review/SKILL.md` / 例: `examples/verify.strict.example.json`。

### v2.0+ : 真の external model diversity (dual-codex mode)

v1.x までは Reviewer B も Claude (Sonnet alias) なので同一モデルファミリーの blind spot を共有する制約があった。 v2.0 で **Reviewer B を OpenAI Codex CLI subprocess に切替可能**、 異 vendor で独立レビュー。

#### 5.1 codex CLI セットアップ (one-time)

認証は **2 path のどちらかで OK**:

**(a) ChatGPT subscription auth (推奨)** — ChatGPT Plus / Pro / Team / Enterprise の subscription があれば API key 不要:

```bash
brew install --cask codex     # macOS 推奨
codex login                   # ブラウザで ChatGPT に sign-in
codex login status            # "Logged in using ChatGPT" を確認
```

**(b) API key auth (CI / 自動化向け)** — OpenAI の API key を使う:

```bash
brew install --cask codex                                # macOS
# or: npm install -g @openai/codex                       # Linux / 任意

export OPENAI_API_KEY=sk-...                             # shell rc に永続化
printenv OPENAI_API_KEY | codex login --with-api-key     # codex に取り込み
codex login status                                       # "Logged in using API key" を確認
```

注意: codex CLI v0.128 では `OPENAI_API_KEY` を、 v0.130+ docs は `CODEX_API_KEY` を言及。 両方試して effective な方を採用する。 設定後は `codex login --with-api-key` で codex 内部 (`~/.codex/`) に取り込むのが確実。

**(c) `/pev-init-codex` で sanity test + settings 雛形**:

```bash
claude
> /pev-harness:pev-init-codex
```

`/pev-init-codex` は AskUserQuestion で install method / API key 設定先 / `PEV_REVIEWER_MODE` default を user 対話で確定 (詳細は `commands/pev-init-codex.md`)。

#### 5.2 dual-codex で /pev --strict

```text
/pev-harness:pev "Refactor auth middleware to use JWT" --strict --reviewer-mode=dual-codex
```

または `.claude/settings.local.json` の env に `PEV_REVIEWER_MODE=dual-codex` を書けば、 `--strict` だけで自動的に dual-codex が動く。

`verify.json` の `reviewers[]` に claude (opus) と codex の独立 verdict が記録される。

#### 5.3 reviewer mode 4 種

| Mode | Reviewer A | Reviewer B | 使い所 |
|---|---|---|---|
| `claude-only` (default) | verifier 単独 | (なし) | 通常タスク |
| `dual-claude` | claude opus (xhigh) | claude sonnet (high) | v1.x 互換 |
| `dual-codex` (v2.0+) | claude opus (xhigh) | codex CLI subprocess | 真の external diversity |
| `codex-only` (v2.0+) | (なし) | codex CLI 単独 | cost 削減 path |

#### 5.4 Fallback behavior

codex CLI 不在 / 未認証 (`codex login status` が "Not logged in") / timeout / non-zero exit の場合、 verifier は自動で `dual-claude` (または `claude-only`) に degrade し、 `verify.json.fallback_reason` に理由を記録 (`codex_not_installed` / `codex_not_authenticated` / `codex_timeout` / `schema_violation` / `schema_missing`)。 PEV pipeline 全体は止まらない (graceful degrade)。

#### 5.5 Privacy 注意

dual-codex / codex-only mode では git diff が **OpenAI (Codex) にも送信** されます。 Anthropic Claude 経由でも同じ送信は発生しているが、 team policy で「OpenAI への送信は禁止」 のケースもあるので、 適用前に確認してください。 OPENAI への送信を避けたいときは `claude-only` / `dual-claude` のままで OK。

詳細: `skills/pev-bootstrap-codex/SKILL.md` / `skills/pev-external-reviewer/SKILL.md` / SPEC.md §10 + ADR-006 / ADR-007。

## 6. トラブルシューティング (FAQ)

| 症状 | 原因 | 対処 |
|---|---|---|
| `/pev-harness:pev` が認識されない | plugin がロードされていない | `claude --plugin-dir ~/pev-harness/repos/myksyut/pev-harness` で session起動、または `~/.claude/plugins/repos/myksyut/` に clone |
| planner が "Goal/Constraints/AC を教えて" と返す | 初回プロンプトに3要素が不足 | `pev-spec-template` skill のテンプレに沿って書き直す |
| Gate A で止まらない (default なのに execute まで行く) | v0.5 以前の plugin | v0.6.0+ に更新 (`git pull` for repo) |
| verify が同じ理由で 3 回 FAIL | plan.md 自体が誤っている可能性 | `/pev-harness:pev-status --escalate` で診断、`/pev-harness:pev-plan` で計画を revise |
| artifacts/ が project に出てくる | gitignore 未追加 | `echo "artifacts/" >> .gitignore` |
| `~/.claude/pev/` に stale task が溜まる | 完了後 cleanup されていない | `/pev-harness:pev-status --gc --apply` |
| executor が並列起動しない | 独立ファイルでない / `--parallel` 未指定 | plan.md の File-level changes を独立にする、`/pev-harness:pev-execute --parallel` |
| Phase 2 中に Claude が「ユーザー意図を尊重して続行」 | v0.6 で修正済み、古い session | session 再起動、または最新版 pull |

## 7. v1.0 既知の制約

- **dual review のmodel diversity は限定的** — Reviewer A/B 両方 Claude family。真の外部model対応は v2.0 (Issue #9)
- **Linear連携なし** — v1.1 (Issue #8) で対応予定
- **言語別tooling 非バンドル** — プロジェクト側で formatter/linter を用意 (これは設計判断、変えない予定)
- **Windows未検証** — macOS / Linux のみ動作確認

## 8. チームでの運用ルール (推奨)

- `team-conventions.md` は PR レビュー対象に含める
- `artifacts/` は gitignore (タスク固有のため)
- `/pev-harness:pev --strict` は main へのマージ前必須
- ペアプロ的な小修正は `/pev-harness:pev` を使わず通常モードで
- `permissionMode` のデフォルトは `default` 維持 (重要変更時のレビュー保全のため)

## 9. フィードバック方法

- [GitHub Discussions](https://github.com/myksyut/pev-harness/discussions) — questions / ideas / show & tell
- [GitHub Issues](https://github.com/myksyut/pev-harness/issues) — bug reports / feature requests (templates あり)
- [Security Advisories](https://github.com/myksyut/pev-harness/security/advisories/new) — 脆弱性は public 報告せず private 報告
- Organization 内 deployment の場合: 各組織の内部チャネル (Slack/Teams) + 上記 GitHub channels

## 10. ロールアウト管理者向け (Organization-internal)

組織内で複数チームに展開する場合は [guide/ROLLOUT-CHECKLIST.md](./guide/ROLLOUT-CHECKLIST.md) と [guide/FEEDBACK-TEMPLATE.md](./guide/FEEDBACK-TEMPLATE.md) を使う。これらは organization-internal deployment 向けで、個人 OSS user は無視してOK。
