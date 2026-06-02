---
name: pev-external-reviewer
description: 外部 LLM CLI (v2.0 では OpenAI Codex) を Reviewer として subprocess invoke する skill。 git diff + plan.md + rubric を組み立てて codex exec --json --output-schema に渡し、 structured JSON output を verify.json に merge する。 timeout / non-zero exit / 認証失敗時は自動で dual-claude にfallback (graceful degrade)。
---

# pev-external-reviewer

v2.0 で導入された **external reviewer 起動** skill。 OpenAI Codex CLI を subprocess として呼び、 schema 強制 JSON を受け取って verifier の verify.json に merge する。 v2.1+ で Gemini CLI 等の他 vendor を同じ pattern で増設できるよう、 「subprocess + JSON schema + fallback」 を抽象化している。

## When to Use

- `PEV_REVIEWER_MODE` が `dual-codex` または `codex-only` の時、 verifier dispatch logic から起動
- `/pev <task> --reviewer-mode=dual-codex` で明示指定された時
- v2.0 では provider = `codex` のみ、 v2.1+ で `gemini` 等が追加予定

起動すべきでない場面:

- `PEV_REVIEWER_MODE=claude-only` (default) — 本 skill は dispatch されない
- codex CLI が未 setup (`pev-bootstrap-codex` が未実行) — Preflight が detect、 fallback に即遷移

## Preflight check

skill 起動直後、 以下を確認 (どれか fail なら **即 fallback** + `verify.json.fallback_reason` 記録):

1. **codex CLI 存在**: `command -v ${PEV_CODEX_BIN:-codex}` で確認、 不在なら `fallback_reason="codex_not_installed"`
2. **認証状態**: `codex login status` を確認 (subscription auth または API key auth どちらでも OK):
   - `"Logged in using ChatGPT"` (subscription) → OK
   - `"Logged in using API key"` または `"Logged in"` (API key 経由) → OK
   - `"Not logged in"` または取得失敗 → `fallback_reason="codex_not_authenticated"`
3. **schema file 存在**: `schemas/codex-reviewer-output.json` を確認、 不在なら `fallback_reason="schema_missing"`

fallback 先は `PEV_REVIEWER_MODE` 値次第:

- `dual-codex` → `dual-claude` (Reviewer B が codex → sonnet に降格)
- `codex-only` → `claude-only` (single verifier)

fallback 時は warning を stderr に出力、 verify.json に `reviewer_mode` (=実行モード) と `intended_reviewer_mode` (=要求モード) を両方記録。

## Invocation pattern

### codex exec の正確な command line (v2.0 で確立、 dog food 実証済)

```bash
PROMPT_FILE=$(mktemp -t pev-reviewer-prompt-XXXXXX)
OUTPUT_FILE=$(mktemp -t pev-reviewer-output-XXXXXX).json
STDERR_FILE=$(mktemp -t pev-reviewer-stderr-XXXXXX)

# Step A: prompt 構築 (git diff + plan AC + rubric を 1 file にまとめる)
cat > "$PROMPT_FILE" <<EOF
あなたはコードレビュアーです。 以下の rubric に従って構造化 JSON を返してください。

## Rubric
- verdict: PASS / FAIL のいずれか
- critical_issues: 確実に修正が必要な指摘 (bug / security / contract violation)
- suggestions: 任意の改善提案 (style / refactor / docs)
- ac_coverage: AC ごとの met (true/false) と evidence

## Plan / AC
$(cat artifacts/plan.md)

## Diff
$(git diff)

## Constraints
- AC を 1 つずつチェックして evidence を引用すること
- LLM 推測ではなく diff と plan.md に書かれた事実のみを根拠にすること
- output schema に従って JSON を 1 つだけ返すこと
EOF

# Step B: portable timeout wrapper (v2.0 dog food finding F1)
# macOS default では `timeout` コマンドが不在 → gtimeout (coreutils) を試す
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_PREFIX=(timeout "${PEV_CODEX_TIMEOUT:-300}")
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_PREFIX=(gtimeout "${PEV_CODEX_TIMEOUT:-300}")
else
  TIMEOUT_PREFIX=()
  echo "WARNING: timeout/gtimeout 不在。 brew install coreutils を推奨 (subprocess の安全な上限制御のため)。 今回は timeout なしで実行" >&2
fi

# Step C: codex 起動
"${TIMEOUT_PREFIX[@]}" \
  "${PEV_CODEX_BIN:-codex}" exec \
    --json \
    --output-schema "schemas/codex-reviewer-output.json" \
    -o "$OUTPUT_FILE" \
    --ephemeral \
    --sandbox "${PEV_CODEX_SANDBOX:-workspace-write}" \
    --skip-git-repo-check \
    "$(cat "$PROMPT_FILE")" \
    2> "$STDERR_FILE"

EXIT=$?
```

**注意 (v2.0 dog food finding F2)**: `--output-schema` に渡す JSON Schema は **OpenAI structured outputs strict 仕様** に従う必要:

- `properties` の全 key を `required` 配列に含めること (optional 不可)
- optional 項目は型を `["string", "null"]` 等で表現して null 許容にする
- `additionalProperties: false` を全 object level に書く
- `oneOf` / `anyOf` 等は使用不可

`schemas/codex-reviewer-output.json` は v2.0 で既に strict 仕様に揃えて出荷済。 team が custom rubric を追加する際も同 spec を踏襲する。

### Exit code handling

| Exit | 意味 | skill 挙動 |
|---|---|---|
| 0 | 正常終了 | `OUTPUT_FILE` を parse → reviewer JSON として merge |
| 124 | timeout (`timeout` command 由来) | fallback、 `fallback_reason="codex_timeout"` |
| その他 non-zero | codex 内部 error (auth / network / sandbox 違反) | stderr を verify.json の `reviewers[].error` に記録 + fallback |

### Output parse

`OUTPUT_FILE` は `--output-schema` の強制で JSON 1 件。 `JSON.parse` 失敗 (schema 違反) は fallback 対象 (`fallback_reason="schema_violation"`)。

### Sandbox

default は `workspace-write` (workspace 内 file write 可、 network 不可)。 codex は review 用途で read-only 動作のはずだが、 万一 file 書き換えが起きると pev pipeline と衝突するため `workspace-write` を選択して **意図しない write を artifacts/ 配下に閉じ込める**。 `--sandbox danger-full-access` は **禁止** (skill 内 hard-coded で reject)。

## verify.json への merge

```json
{
  "verdict": "PASS",
  "reviewer_mode": "dual-codex",
  "intended_reviewer_mode": "dual-codex",
  "fallback_reason": null,
  "reviewers": [
    {
      "provider": "claude-opus-4-8",
      "verdict": "PASS",
      "critical_issues": [],
      "suggestions": ["..."],
      "raw_output_excerpt": "..."
    },
    {
      "provider": "codex/<model>",
      "verdict": "PASS",
      "critical_issues": [],
      "suggestions": ["..."],
      "raw_output_path": "/tmp/pev-reviewer-output-XXXXX.json",
      "latency_ms": 47200
    }
  ],
  "merge": {
    "agreement_pct": 92,
    "both_pass": true,
    "critical_issues_dedupe": [],
    "final_verdict": "PASS"
  }
}
```

merge ロジックは現 `pev-dual-review` の dedupe + agreement_pct を踏襲、 provider field を追加して trace 可能化。

## 並列起動 (`dual-codex` mode)

verifier が dispatch する時、 Reviewer A (claude opus) と Reviewer B (codex) を **同一メッセージ内で同時起動**:

- Reviewer A: Agent tool で `subagent_type=verifier`, `model=opus`
- Reviewer B: Bash tool で `codex exec` subprocess (本 skill の Invocation pattern)

両者の完了を待って merge。 codex は subprocess なので OS process boundary で context isolation が自然、 Claude 側の Agent 並列起動と同じ独立性が確保される。

## Security considerations

- 認証は codex CLI 内部 (`~/.codex/` session token or env var) で管理、 本 skill は **API key / session token を読まない**
- stderr file (`$STDERR_FILE`) は verify.json への記録時に「API key 系トークンを含む可能性のある行を redact」 する filter を通す (e.g., `sed -E 's/(sk-[A-Za-z0-9_-]{20,})/[REDACTED]/g'`)
- prompt は git diff を含むので、 codex 側にもコードが送られる。 これは Anthropic Claude 経由でも同じだが、 OpenAI への送信は team policy で禁止されているケースあり → ONBOARDING で明示

## Examples

### dual-codex mode で /pev --strict

```bash
PEV_REVIEWER_MODE=dual-codex /pev "Add /healthz endpoint" --strict
```

verifier が:
1. claude verifier 単独 verify を実行 (build / type / lint / unit / e2e)
2. 同時に Reviewer A (claude opus subagent) + Reviewer B (codex subprocess) を起動
3. 両者の JSON を merge して final verdict を verify.json に書く

### codex-only mode (cost 削減)

```bash
PEV_REVIEWER_MODE=codex-only /pev "Refactor: rename foo to bar"
```

claude verifier を skip、 codex 単独で verify。 token cost が低い軽微 task 向け。

## Related

- [`pev-bootstrap-codex`](../pev-bootstrap-codex/SKILL.md) — codex CLI / API key setup の preflight
- [`pev-dual-review`](../pev-dual-review/SKILL.md) — Reviewer A=claude を起動する側 (本 skill は Reviewer B の codex 起動を担当)
- [`agents/verifier.md`](../../agents/verifier.md) — PEV_REVIEWER_MODE dispatch logic
- `schemas/codex-reviewer-output.json` — codex 出力 JSON schema (v2.0 新規)
- Codex CLI 公式 docs: <https://developers.openai.com/codex/noninteractive>

## Notes

- skill 自体は **stateless**、 各 verify round で fresh に invoke (前 round の codex session を引き継がない、 `--ephemeral` flag で保証)
- codex CLI の `--model` flag は v0.130 時点で interactive `/model` command のみ documented、 future v2.1+ で env var (`PEV_CODEX_MODEL`) → flag mapping を検討
- v2.0 では provider = `codex` 1 種、 v2.1+ で `gemini` / 他 vendor を本 skill 内の switch / case で拡張する想定 (interface = subprocess + JSON schema)
