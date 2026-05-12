---
name: pev-bootstrap-codex
description: OpenAI Codex CLI を pev-harness の external reviewer として導入する one-time setup skill。 codex CLI install 確認 (npm i -g @openai/codex または brew install --cask codex)、 CODEX_API_KEY 環境変数の存在確認、 codex exec --json で sanity test、 settings.local.json の PEV_REVIEWER_MODE 雛形提案までを 1 操作で完了する。 v1.4 pev-bootstrap-playwright + v1.9 pev-bootstrap-project と並列の sibling。
disable-model-invocation: true
---

# pev-bootstrap-codex

`/pev-init-codex` で呼ばれる **one-time setup** skill。 v2.0 で導入された `pev-external-reviewer` skill を使えるようにする preflight setup。 v1.4 で確立した `pev-bootstrap-playwright` pattern を external reviewer に拡張した sibling。

## When to Use

起動すべき場面:

- `/pev-init-codex` が user に呼ばれた時
- `pev-external-reviewer` skill の Preflight で「codex CLI 未setup」 を検知した時 (auto-propose)
- v2.0 + `PEV_REVIEWER_MODE=dual-codex|codex-only` を有効化したい時

起動すべきでない場面:

- codex CLI が既に install 済 + `CODEX_API_KEY` 設定済 + sanity test pass の場合 (Preflight が detect、 idempotent skip)
- 外部 model を使わない方針のチーム (`PEV_REVIEWER_MODE=claude-only` で固定する場合)

## CLI flags

- `--dry-run`: 「実行予定 + 検知結果」 を stdout に full block で出力、 実 install は行わない
- `--force`: idempotent skip も bypass、 既存 install 済でも sanity test を再実行

## Bootstrap Steps

### Step 1: Preflight check

codex CLI は **2 種類の認証方式** をサポート (どちらか 1 つで OK):

- **(a) ChatGPT subscription auth** (default、 推奨): `codex login` で ChatGPT account に sign-in 済の状態。 ChatGPT Plus / Pro / Team / Enterprise の subscription が必要、 API call cost は別途発生せず subscription 内で消費
- **(b) API key auth**: `OPENAI_API_KEY` 環境変数 (v0.128+) または `CODEX_API_KEY` (v0.130+ docs)。 `printenv OPENAI_API_KEY | codex login --with-api-key` で codex に教える

```bash
# codex CLI 存在確認 + version
CODEX_BIN=${PEV_CODEX_BIN:-codex}
if command -v "$CODEX_BIN" >/dev/null 2>&1; then
  CODEX_VERSION=$("$CODEX_BIN" --version 2>/dev/null || echo unknown)
  CODEX_INSTALLED=true
else
  CODEX_INSTALLED=false
fi

# 認証状態確認 (subscription / API key どちらかが effective なら OK)
AUTH_STATUS=$("$CODEX_BIN" login status 2>/dev/null || echo "Not logged in")
case "$AUTH_STATUS" in
  *"Logged in using ChatGPT"*)
    AUTH_MODE="subscription"; AUTHENTICATED=true ;;
  *"Logged in using API key"*|*"Logged in"*)
    AUTH_MODE="api_key"; AUTHENTICATED=true ;;
  *)
    AUTH_MODE="none"; AUTHENTICATED=false ;;
esac
```

idempotent: `CODEX_INSTALLED=true` かつ `AUTHENTICATED=true` かつ Step 4 sanity test pass なら early exit + 「既に setup 済 (auth: $AUTH_MODE)」 message。 `--force` 時のみ bypass。

### Step 2: codex CLI install

`CODEX_INSTALLED=false` の場合のみ。 install path 自動検知 (上から優先):

| 環境 | install command |
|---|---|
| macOS + Homebrew (`brew` あり) | `brew install --cask codex` |
| Linux / 任意 + npm 書き込み可 | `npm install -g @openai/codex` |
| nix / npm global 不可 | manual: GitHub releases page から binary download (`https://github.com/openai/codex/releases/latest`)、 PATH を通す |

skill は user に AskUserQuestion で「どの install method?」 を確認 (`--force` 時は brew → npm → manual の順で auto-try、 全部 fail なら hard error)。

install 後、 Step 1 を再実行して `CODEX_INSTALLED=true` を再確認。

### Step 3: 認証設定確認

`AUTHENTICATED=false` の場合、 user に AskUserQuestion で 3 択を提示:

```text
Q: codex CLI が未認証です。 どちらで認証しますか?
- (a) ChatGPT subscription (推奨、 ChatGPT Plus / Pro / Team / Enterprise の login):
      `codex login` を別 terminal で実行、 ブラウザで ChatGPT に sign-in
- (b) API key (CI / 自動化向け):
      `printenv OPENAI_API_KEY | codex login --with-api-key` で codex に取り込み。
      OPENAI_API_KEY env var は shell rc / direnv に永続化
- (c) 後で自分で設定する:
      skill は sanity test を skip、 user が後で `codex login` を実行
```

skill 自身は **API key 値を読まない / 書かない** (security の理由、 user が rc に書く形を推奨)。 subscription auth path では env var すら不要。

API key 認証時の env var 名:

- **`OPENAI_API_KEY`** (codex CLI v0.128+ の login help が言及、 dog food で実証済)
- **`CODEX_API_KEY`** (v0.130+ の public docs が言及)

skill は先に `OPENAI_API_KEY` をチェックし、 不在なら `CODEX_API_KEY` を試す。 両方不在ならまだ未認証。 codex CLI の version によってどちらが effective かが変わるため、 user 環境に合わせて auto-detect する。

### Step 4: Sanity test

`CODEX_INSTALLED=true` かつ `AUTHENTICATED=true` なら以下を実行:

```bash
# git repo 外でも動くよう --skip-git-repo-check、 session を残さないよう --ephemeral
RESULT=$(timeout 60 codex exec --json --skip-git-repo-check --ephemeral \
  --sandbox workspace-write \
  "Reply with the single word 'pong'" 2>&1)
echo "$RESULT" | tail -5
```

期待: JSONL の中に `"item.message_content"` のような final assistant message があり、 内容が "pong" 系の短文。 timeout / non-zero exit / 認証 error の場合は warning + 「`codex login status` で認証状態を確認してください」 hint。

### Step 5: settings.local.json 雛形提案

AskUserQuestion で multi-select:

```text
Q: PEV reviewer 設定の default を決めますか? (.claude/settings.local.json に書く)
- [ ] PEV_REVIEWER_MODE=dual-codex   (--strict 時 A=claude-opus + B=codex)
- [ ] PEV_REVIEWER_MODE=codex-only  (codex 単独 verifier、 cost 削減)
- [ ] 設定しない (毎回 CLI flag で指定)
```

選択された値を `.claude/settings.local.json` の `env.PEV_REVIEWER_MODE` に書き込み (既存があれば merge)。

### Step 6: Result summary

通常モードで以下を **assistant 最終応答テキスト = stdout** に full block で出力 (v1.9 dog food finding F1 と同方針):

```text
[pev-init-codex] complete

Detected:
  codex CLI:   0.130.0 (installed via brew)
  auth mode:   subscription (Logged in using ChatGPT)
  sanity test: PASS (latency: 2.3s)

Configured:
  .claude/settings.local.json: env.PEV_REVIEWER_MODE = dual-codex

Next steps:
  1. /pev "Your task" --reviewer-mode=dual-codex   # 1回試す
  2. /pev "Your task" --strict                     # PEV_REVIEWER_MODE が dual-codex なので codex も走る
  3. verify.json.reviewers[] で codex 結果を確認

Fallback behavior:
  codex CLI が runtime に fail した場合、 自動で dual-claude に degrade、 verify.json.fallback_reason に記録
```

`--dry-run` 時は実 install / 書き込み行わず予定のみ出力。

## Security considerations

- skill 自身は API key の値を **read しない**、 値 setting は user が rc / direnv / `codex login --with-api-key` で行う
- subscription auth path では API key 不要、 codex 内部 (`~/.codex/`) に session token が保存される (codex CLI が管理)
- sanity test の output は最終 message のみ表示、 full JSONL stream は表示しない (API レスポンスの誤含有 PII を minimize)
- `.claude/settings.local.json` は user-local (gitignore 推奨)、 settings.json (team 共有) には書かない

## Examples

### macOS で初回 setup (subscription auth、 推奨)

```bash
brew install --cask codex
codex login           # ブラウザで ChatGPT に sign-in
codex login status    # "Logged in using ChatGPT" を確認
claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init-codex'
```

### CI 用 (API key auth)

```bash
brew install --cask codex
printenv OPENAI_API_KEY | codex login --with-api-key
codex login status    # "Logged in using API key" を確認
claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init-codex --force'
```

### dry-run で内容確認

```bash
claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init-codex --dry-run'
```

→ install / 書き込み行わず、 「現状 + 予定」 だけ出力。

### CI / 自動化 (--force + API key auth)

```bash
export OPENAI_API_KEY=$SECRET_OPENAI_KEY
printenv OPENAI_API_KEY | codex login --with-api-key
claude --plugin-dir ~/pev-harness --print '/pev-harness:pev-init-codex --force'
```

→ interactive prompts skip + install method auto-try + sanity test 必ず実行。

## Related

- [`pev-external-reviewer`](../pev-external-reviewer/SKILL.md) — v2.0 codex を Reviewer として呼ぶ skill (本 skill が setup する対象)
- [`pev-bootstrap-playwright`](../pev-bootstrap-playwright/SKILL.md) — v1.4 sibling (E2E 専用)
- [`pev-bootstrap-project`](../pev-bootstrap-project/SKILL.md) — v1.9 sibling (project 全体)
- `commands/pev-init-codex.md` — 本 skill の薄い CLI ラッパー
- Codex CLI 公式 docs: <https://developers.openai.com/codex/noninteractive>

## Notes

- skill は **idempotent** に設計: 同じ環境で何度 invoke しても install 済なら no-op (Preflight が早期 exit)
- `--force` は user の明示的 override channel、 skill 自身が判断して付与してはならない
- codex CLI 自身に timeout flag なし → wrap 側で `timeout` command を使う方針を pev-external-reviewer / verifier に統一
- 認証は **2 path**: (a) ChatGPT subscription auth (推奨、 `codex login` でブラウザ sign-in)、 (b) API key auth (`OPENAI_API_KEY` env var を stdin で渡す `codex login --with-api-key`)。 codex v0.128 dog food で subscription auth が default として実証済。 `CODEX_API_KEY` は public docs で言及されているが v0.128 の help では `OPENAI_API_KEY` 表記のため両方確認
