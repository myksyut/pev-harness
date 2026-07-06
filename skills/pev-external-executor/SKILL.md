---
name: pev-external-executor
description: 外部 LLM CLI (v3.5.0 では OpenAI Codex) を Execute phase の実装エンジンとして subprocess invoke する skill。 plan.md (Mode A) または task description + triage.json + cwd context (Mode B) と team-conventions を 1 prompt にまとめて codex exec --json --output-schema に渡し、 codex が workspace-write sandbox 内で file を編集する。 codex 不在 / 未認証 / timeout / non-zero exit 時は executor agent に fallback signal を返す (= Claude native 実装に degrade)。 v2.0 pev-external-reviewer の対称形 (reviewer ではなく executor 版)。
---

# pev-external-executor

v3.5.0 で導入された **external executor 起動** skill。 OpenAI Codex CLI を subprocess として呼び、 Execute phase の **実 file 編集** を委譲する。 v2.0 `pev-external-reviewer` (= codex を Reviewer として呼ぶ) の対称形で、 「subprocess + JSON schema + fallback」 の抽象を共有する。

**重要 (責務分離、 v3.5.0 設計判断)**: codex は **raw な file 編集のみ** を担う。 `execute.log` の authoring / DRY self-review / judgment traceability / Mode B Self-Clarify は **Claude executor agent (wrapper)** が担当する (= `agents/executor.md` の Codex delegation mode)。 本 skill は codex 起動の機構だけを提供し、 pipeline の audit 成果物には触れない。

## When to Use

- `PEV_EXECUTOR_MODE=codex` の時、 `agents/executor.md` の Codex delegation mode から dispatch される
- `/pev <task> --executor-mode=codex` で明示指定された時
- v3.5.0 では provider = `codex` のみ、 将来 `gemini` 等を同じ subprocess pattern で増設する想定

起動すべきでない場面:

- `PEV_EXECUTOR_MODE=claude` (= codex default を override した場合) — 本 skill は dispatch されず、 executor agent が native に実装する
- codex CLI が未 setup (`pev-bootstrap-codex` が未実行) — Preflight が detect、 fallback signal を返す

## Preflight check

skill 起動直後、 以下を確認 (どれか fail なら **即 fallback signal を返す**、 codex は起動しない):

1. **codex CLI 存在**: `command -v ${PEV_CODEX_BIN:-codex}` で確認、 不在なら `fallback_reason="codex_not_installed"`
2. **認証状態**: `codex login status` を確認 (subscription auth または API key auth どちらでも OK):
   - `"Logged in using ChatGPT"` (subscription) → OK
   - `"Logged in using API key"` または `"Logged in"` (API key 経由) → OK
   - `"Not logged in"` または取得失敗 → `fallback_reason="codex_not_authenticated"`
3. **schema file 存在**: `schemas/codex-executor-output.json` を確認、 不在なら `fallback_reason="schema_missing"`

fallback signal は executor agent に返す。 executor agent はそれを受けて **Claude native 実装** に degrade し、 `execute.log` の冒頭に `executor_mode` (=実行モード) と `intended_executor_mode` (=要求モード) と `fallback_reason` を記録する。 本 skill 自身は execute.log を書かない。

## Invocation pattern

### prompt 構築 (Mode A / Mode B)

executor agent から渡された mode を見て codex prompt を組む。 codex は plan.md / cwd を自分で読めるが、 **必要 context を 1 prompt に集約** して one-shot 実装の精度を上げる。

**Mode A (plan ベース)**: `.pev-artifacts/plan.md` の `## File-level changes` を実装指示として渡す。

**Mode B (plan-less)**: task description + `.pev-artifacts/triage.json` の `reasoning` / `context_signals` を渡し、 「cwd の既存 pattern を踏襲」 と明示する。

両 mode 共通で `team-conventions.md` (= `pev-team-conventions` skill の load 順) の `## Code style` / `## Forbidden` / `## Files to never touch` を prompt に含める。

```bash
PROMPT_FILE=$(mktemp -t pev-executor-prompt-XXXXXX)
OUTPUT_FILE=$(mktemp -t pev-executor-output-XXXXXX).json
STDERR_FILE=$(mktemp -t pev-executor-stderr-XXXXXX)

# Step A: prompt 構築
cat > "$PROMPT_FILE" <<EOF
あなたは実装担当エンジニアです。 以下の brief に従って cwd の file を編集してください。

## 実装方針

- brief の指示範囲のみ実装する。 brief に書かれていない drive-by リファクタは禁止
- cwd の既存実装と team-conventions を読み、 既存 pattern を踏襲する
- brief から実装方針が一意に決められない不明確点に直面したら、 **file を 1 つも編集せず** に status=ambiguity_stop で停止し、 ambiguity_note に質問と選択肢を書く
- output schema に従って JSON を 1 つだけ返す。 file の実編集は schema の外で行う (= 実 file system を直接書き換える)

## Brief

$BRIEF_BODY

## Team conventions

$TEAM_CONVENTIONS

## Output 契約

- file を編集したら status=implemented、 files_changed に編集した file を列挙
- 不明確点で停止したら status=ambiguity_stop、 ambiguity_detected=true、 file 編集なし
- 編集不要なら status=no_change
EOF

# Step B: portable timeout wrapper (pev-external-reviewer と共通方針)
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_PREFIX=(timeout "${PEV_CODEX_EXEC_TIMEOUT:-600}")
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_PREFIX=(gtimeout "${PEV_CODEX_EXEC_TIMEOUT:-600}")
else
  TIMEOUT_PREFIX=()
  echo "WARNING: timeout/gtimeout 不在。 brew install coreutils を推奨。 今回は timeout なしで実行" >&2
fi

# Step C: codex 起動 (workspace-write sandbox で実 file 編集)
# --model は付けない (= codex CLI の default model)。 PEV_CODEX_MODEL が設定された時のみ pin する
# (dog food F_v35_1: ChatGPT subscription 認証では codex-family model のみ利用可、 後述)
MODEL_FLAG=()
[ -n "$PEV_CODEX_MODEL" ] && MODEL_FLAG=(--model "$PEV_CODEX_MODEL")

"${TIMEOUT_PREFIX[@]}" \
  "${PEV_CODEX_BIN:-codex}" exec \
    --json \
    --output-schema "schemas/codex-executor-output.json" \
    -o "$OUTPUT_FILE" \
    --ephemeral \
    "${MODEL_FLAG[@]}" \
    --sandbox "${PEV_CODEX_SANDBOX:-workspace-write}" \
    --skip-git-repo-check \
    "$(cat "$PROMPT_FILE")" \
    2> "$STDERR_FILE"

EXIT=$?
```

**この invocation が canonical** (dog food F_v35_2)。 executor agent は上記 flag 構成をそのまま使う。 簡略化 (`--json` / `--output-schema` / `-o` / `--ephemeral` を省く、 `--approval-mode` を足す 等) はしない:

- `codex exec` は元々 non-interactive なので `--approval-mode full-auto` は不要 (`--sandbox` が approval を兼ねる)
- `--output-schema` を省くと codex が structured JSON (`codex-executor-output.json`) を返さず、 `ambiguity_detected` の二次検知 net が失われる
- ただし **diff の source of truth は常に `git diff`**。 codex の `files_changed` 自己申告は cross-check 用で、 万一 structured JSON が取れなくても executor agent は `git diff` で実変更を確定できる

**注意**: `--output-schema` に渡す JSON Schema は **OpenAI structured outputs strict 仕様** に従う (全 key required、 optional は `["string","null"]` 等、 `additionalProperties: false`、 `oneOf`/`anyOf` 不使用)。 `schemas/codex-executor-output.json` は v3.5.0 で strict 仕様に揃えて出荷済。

### Sandbox

default は `workspace-write` (= workspace 内 file write 可、 network 不可)。 reviewer は「意図しない write の封じ込め」 で workspace-write を選んだが、 executor は **実 file 編集が本来の目的** なので workspace-write が必須要件。 `--sandbox danger-full-access` は **禁止** (skill 内 hard-coded で reject)。 codex は build / test を走らせない (= verifier の責務)、 network 不要。

### codex の model 指定 (dog food F_v35_1)

上記 invocation は **`--model` flag を付けない** (= codex CLI が account 種別に応じた default model を選ぶ)。 v3.5.0 dog food で、 executor agent が独自に `codex exec --model o4-mini` を付けて起動し、 `The 'o4-mini' model is not supported when using Codex with a ChatGPT account.` (HTTP 400) で fail → retry した事象が出た。

- **ChatGPT subscription 認証では codex-family の model のみ利用可**。 `o4-mini` 等の汎用 OpenAI model は 400 reject される
- 本 skill / executor agent は **`--model` を付与しない**。 codex CLI の default に委ねる (ChatGPT auth なら `gpt-5.5` 等の codex-family、 API key auth なら codex が解決)
- model を pin したい team は `PEV_CODEX_MODEL` env var を設定する。 skill はそれが**存在する時のみ** `--model "$PEV_CODEX_MODEL"` を足す (未設定が default = 無指定)。 ChatGPT auth で pin する場合は codex-family の model 名を指定すること

### Exit code handling

| Exit | 意味 | skill 挙動 |
|---|---|---|
| 0 | 正常終了 | `OUTPUT_FILE` を parse → executor agent に渡す |
| 124 | timeout (`timeout` command 由来) | fallback signal、 `fallback_reason="codex_timeout"`。 **部分的に編集された file が残る可能性** → executor agent が `git diff` で検知し、 `git checkout -- .` で破棄してから native 実装に degrade |
| その他 non-zero | codex 内部 error (auth / network / sandbox 違反) | stderr を `STDERR_FILE` から拾い、 fallback signal + `fallback_reason="codex_error"` |

### Output parse

`OUTPUT_FILE` は `--output-schema` 強制で JSON 1 件。 `JSON.parse` 失敗 (schema 違反) は fallback 対象 (`fallback_reason="schema_violation"`)。

parse 成功時、 executor agent に渡す:

- `status` (`implemented` / `ambiguity_stop` / `no_change`)
- `files_changed[]` (codex の自己申告、 executor agent が `git diff` と cross-check する)
- `ambiguity_detected` / `ambiguity_note` (true なら executor agent が `.pev-artifacts/clarification.md` を書く)
- `commit_message` / `model` / `notes`

## executor agent への返却

本 skill は execute.log を書かず、 以下を executor agent に返すだけ:

```
[pev-external-executor result]
- exit: 0
- output_json: /tmp/pev-executor-output-XXXXX.json
- status: implemented
- files_changed (codex self-report): src/validation.js, tests/validation.test.js
- ambiguity_detected: false
```

fallback 時:

```
[pev-external-executor fallback]
- fallback_reason: codex_not_authenticated
- intended_executor_mode: codex
- 推奨: executor agent は Claude native 実装に degrade
```

codex が file を編集した後の **diff の読み直し / DRY self-review / judgment trace / execute.log authoring** は `agents/executor.md` の Codex delegation mode が担う。

## Security considerations

- 認証は codex CLI 内部 (`~/.codex/` session token or env var) で管理、 本 skill は **API key / session token を読まない / 書かない**
- stderr file (`$STDERR_FILE`) を executor agent に渡す時は「API key 系トークンを含む可能性のある行を redact」 する filter を通す (e.g., `sed -E 's/(sk-[A-Za-z0-9_-]{20,})/[REDACTED]/g'`)
- prompt は plan.md / task description / cwd の既存コードを含むので、 codex (OpenAI) 側にもコードが送られる。 これは Reviewer として使う `pev-external-reviewer` と同じ送信範囲だが、 OpenAI への送信が team policy で禁止されているケースあり → ONBOARDING で明示。 executor mode は **編集対象 file 全体** が送られうるので reviewer mode より送信範囲が広い点に注意
- codex は `workspace-write` sandbox 内でのみ file を書く。 workspace 外 / network は sandbox が遮断

## Examples

### codex executor mode で /pev

```bash
PEV_EXECUTOR_MODE=codex /pev "validateInquiry 純関数を src/validation.js に追加"
```

executor agent が:

1. team-conventions + cwd context を読み、 Mode B Self-Clarify pre-check を実施
2. pre-check pass なら本 skill を dispatch
3. 本 skill が codex prompt を組み、 `codex exec` で codex が file 編集
4. executor agent が `git diff` を読み、 DRY self-review + judgment trace + execute.log を authoring

### fallback (codex 未認証)

```bash
PEV_EXECUTOR_MODE=codex /pev "Add subtract(a, b)"
```

本 skill の Preflight が `codex_not_authenticated` を検知 → executor agent が Claude native 実装に degrade、 `execute.log` 冒頭に `fallback_reason` を記録。 pipeline は止まらない。

## Related

- [`pev-bootstrap-codex`](../pev-bootstrap-codex/SKILL.md) — codex CLI / 認証 setup の preflight (reviewer / executor 共通)
- [`pev-external-reviewer`](../pev-external-reviewer/SKILL.md) — v2.0 codex を Reviewer として呼ぶ対称 skill
- [`agents/executor.md`](../../agents/executor.md) — Codex delegation mode (本 skill の dispatch 元 + wrapper 責務)
- `schemas/codex-executor-output.json` — codex 出力 JSON schema (v3.5.0 新規)
- Codex CLI 公式 docs: <https://developers.openai.com/codex/noninteractive>

## Notes

- skill 自体は **stateless**、 各 Execute round で fresh に invoke (`--ephemeral` flag で前 round の codex session を引き継がない)
- executor mode は provider = `codex` 1 種 (v3.5.0)、 reviewer mode と同じく将来 `gemini` 等を switch / case で拡張する想定
- `--parallel` (= 並列 executor) は codex executor mode では無視される。 codex は 1 回の `codex exec` で複数 file を編集できるため、 並列 subprocess 化はせず serial 1 invocation で task 全体を処理する
- codex CLI 自身に timeout flag なし → wrap 側で `timeout` command を使う方針を pev-external-reviewer と統一。 executor は実装で reviewer より長くかかるため default を `PEV_CODEX_EXEC_TIMEOUT:-600` (reviewer の `PEV_CODEX_TIMEOUT:-300` の倍) に設定
