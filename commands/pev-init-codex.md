---
description: Bootstrap OpenAI Codex CLI as an external reviewer + executor for pev-harness (one-time setup)
---

# /pev-init-codex

OpenAI Codex CLI を pev-harness で使えるようにする one-time setup コマンド。 v1.4 `/pev-init-e2e` + v1.9 `/pev-init` と並列の sibling。 codex は 2 用途で使える (CLI install / 認証は共通、 本コマンド 1 回で両方 setup):

- **external reviewer** (v2.0+、 Verify phase): `--strict` 時に Reviewer B として codex が verify
- **external executor** (v3.5.0+、 Execute phase): `--executor-mode=codex` で実 file 編集を codex に委譲

## Usage

```text
/pev-init-codex             # 通常 setup (interactive prompts あり)
/pev-init-codex --dry-run   # 検知 + 予定を full block で stdout 出力、 実 install / 書き込みなし
/pev-init-codex --force     # interactive skip + idempotent skip も bypass、 sanity test 必ず実行
```

## フロー (pev-bootstrap-codex skill 起動)

1. **Preflight**: `codex --version` / `CODEX_API_KEY` 存在確認、 既に setup 済なら idempotent skip
2. **codex CLI install** (未 install 時のみ): brew → npm → manual の順で AskUserQuestion で確認、 `--force` 時は順次 auto-try
3. **認証設定確認** (`codex login status` が "Not logged in" の時): 3 択 (a) ChatGPT subscription auth (`codex login`)、 (b) API key auth (`OPENAI_API_KEY` を stdin で `codex login --with-api-key`)、 (c) 後で を AskUserQuestion、 skill は値を read / write しない
4. **Sanity test**: `timeout 60 codex exec --json --skip-git-repo-check --ephemeral --sandbox workspace-write "ping"` で pong 系の応答が得られるか確認
5. **settings.local.json 雛形提案**: AskUserQuestion で `PEV_REVIEWER_MODE` (`dual-codex` / `codex-only`) と `PEV_EXECUTOR_MODE` (`codex`) の default を multi-select (両方独立、 設定しない も可)
6. **Result summary**: full block を stdout 出力 (検知結果 + 設定済値 + next steps + fallback 説明)

詳細は [`skills/pev-bootstrap-codex/SKILL.md`](../skills/pev-bootstrap-codex/SKILL.md)。

## 完了後

```text
# reviewer として使う (Verify phase)
/pev "Your task" --reviewer-mode=dual-codex   # 1 回試して codex の出力を verify.json で確認
/pev "Your task" --strict                     # settings に PEV_REVIEWER_MODE=dual-codex を書いた場合

# executor として使う (Execute phase、 v3.5.0+)
/pev "Your task" --executor-mode=codex        # 実装を codex に委譲、 execute.log で結果を確認
```

`verify.json.reviewers[]` に codex の verify 結果、 `execute.log` の `[Executor: codex]` block に codex の実装結果が記録されます。 codex CLI が runtime fail した場合、 reviewer は `dual-claude`、 executor は Claude native 実装に自動 degrade されます (graceful degrade、 `fallback_reason` に記録)。

## Notes

- 認証は 2 path: (a) ChatGPT subscription auth (`codex login` + ブラウザ sign-in、 API key 不要、 v2.0 dog food で実証済)、 (b) API key auth (`OPENAI_API_KEY` env var を `codex login --with-api-key` で取り込み)。 skill は値を扱わない
- codex CLI に timeout flag なし → wrap 側で `timeout ${PEV_CODEX_TIMEOUT:-300}s codex exec ...` を使う
- v2.1+ で Gemini CLI 等の他 vendor 対応を `pev-external-reviewer` の subprocess pattern で同様に拡張予定
