# Onboarding pev-harness

社内チーム展開向けの導入ガイド。v1.0 でロールアウト準備完了。

## 0. Pre-flight check

導入前に以下を確認:

```bash
# Claude Code のバージョン (≥ v2.1.111 必須)
claude --version

# pev-harness のリポジトリへアクセスできるか (private repo)
gh repo view myksyut/pev-harness > /dev/null && echo OK || echo "ACCESS DENIED"
```

アクセスがない場合: メンテナに連絡して GitHub アカウントを repo collaborator に追加してもらう。

## 1. 個人ごとのインストール

```bash
# A. plugin として ~/.claude/plugins に clone (推奨)
cd ~/.claude/plugins
mkdir -p repos/myksyut
cd repos/myksyut
git clone https://github.com/myksyut/pev-harness.git
# Claude Code 再起動で自動認識

# B. 一時利用 (--plugin-dir フラグ、セッション単位)
cd ~/work
git clone https://github.com/myksyut/pev-harness.git
claude --plugin-dir ./pev-harness
```

Aは永続、Bは検証/お試し向け。チーム展開では **A を推奨**。

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

期待される動作 (`permissionMode=default` のとき):

1. `pev-spec-template` skill が Goal / Constraints / AC を整形
2. planner agent が `artifacts/plan.md` 生成
3. **Gate A で停止** (default mode のため)
4. ユーザーが plan.md を読み、問題なければ `/pev-harness:pev-execute`
5. executor が実装、Stop hook が verify を促す
6. ユーザーが `/pev-harness:pev-verify` を打つ、verifier が `verify.json` 生成
7. PASS なら完了。FAIL なら自動 retry (最大3回)

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
