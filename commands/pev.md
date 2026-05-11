---
description: Run full Plan-Execute-Verify pipeline for a coding task
---

# /pev

PEV harnessのメインコマンド。Plan → Execute → Verify を順に実行する。

## Usage

```text
/pev <task description>
/pev <task> --strict                 # dual review有効化
/pev <task> --parallel               # 独立ファイル変更を並列実行
/pev <linear-issue-url>              # Linear Issueから自動展開 (v1.2+)
/pev <linear-issue-url> --strict     # 上記 + dual review
/pev <task> --e2e                    # E2E verify を強制起動 (v1.4+)
/pev <task> --no-e2e                 # E2E verify を強制 skip (v1.4+)
/pev <task> --force-auto             # permissionMode default でも Gate A を skip して Phase 2/3 自動進行 (v1.6+)
```

## Linear URL 検出 (v1.2 で追加)

引数が以下の正規表現にマッチする場合、`pev-linear-sync` skill (inbound) が起動して Linear Issue → spec を構築する:

```regex
linear\.app/[^/]+/issue/([A-Z]+-\d+)
```

抽出した identifier (例: `ENG-123`) を `artifacts/linear/issue_id.txt` に保存。`pev-spec-template` をスキップして直接 planner に Linear-sourced spec を渡す。

Linear MCP plugin (`@plugin_linear_linear`) が install済みかつ認証済みであることが前提。 不在時は warning を出して通常 flow にfallback。

## フロー

1. **引数判定**:
   - Linear URL → `pev-linear-sync` inbound + plan
   - 自然文 → `pev-spec-template` で Goal/Constraints/AC 整形 (不足要素は質問返し)
2. **Phase 1 (Plan)**: planner agent → `artifacts/plan.md`
3. **Gate A**: `permissionMode` 判定で auto / 停止 / 終了 を分岐
4. **Phase 2 (Execute)**: executor agent → コード変更 + `artifacts/execute.log`
5. **Gate B**: Stop hook が verifier を促す
6. **Phase 3 (Verify)**: verifier agent (`--strict` 時は `pev-dual-review`) → `artifacts/verify.json`
7. **Retry Gate**: PASS → 完了 / FAIL → planner に戻る (max 3回)

## Implementation

### Step 1 — Task initialization

```bash
# 既存タスクの検出
if [ -f artifacts/.task_id ]; then
  echo "[PEV] Existing task: $(cat artifacts/.task_id)"
  echo "[PEV] Run '/pev-status' or '/pev-status --clean' first."
  exit 1
fi

# 新規タスク発行
mkdir -p artifacts
TASK_ID="$(date +%s)-$(openssl rand -hex 4 2>/dev/null || printf '%04x%04x' $RANDOM $RANDOM)"
echo "$TASK_ID" > artifacts/.task_id
echo "0" > artifacts/.retry_count
mkdir -p ~/.claude/pev/$TASK_ID
echo "[PEV] Task started: $TASK_ID"
```

### Step 2 — Phase 1 (Plan)

`pev-spec-template` skill で入力整形 → planner agent (model: opus, effort: xhigh) を起動 → `artifacts/plan.md` 出力。

### Step 3 — Gate A (permissionMode判定、**絶対遵守**)

**規約**: Gate A の判断は `/pev` コマンド (この Step 3) の責任。planner agent は plan.md を書き終えたらそこで完全停止する。「ユーザーが続行したいはず」のような推論で executor を勝手に起動してはならない (rules/pev-conventions.md "Gate respect" 参照)。

```bash
# .claude/settings.json または settings.local.json から permissionMode を読む
MODE=$(grep -oh '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' \
       .claude/settings.local.json .claude/settings.json 2>/dev/null \
       | head -1 | cut -d'"' -f4)
MODE=${MODE:-default}

# v1.6+ : --force-auto フラグで explicit override
# user が「default mode だが今回だけ自動進行したい」 ケース (dog food / CI 自動化 等) に使う。
# Gate A 規約 (default mode は停止) を守りつつ、 明示的な user override channel を提供。
FORCE_AUTO=false
[[ "$*" == *"--force-auto"* ]] && FORCE_AUTO=true

if [ "$FORCE_AUTO" = "true" ]; then
  echo "[PEV] Gate A: --force-auto detected — overriding permissionMode=$MODE, proceeding to Phase 2"
  echo "[$(date -u +%FT%TZ)] Gate A overridden by --force-auto (original mode: $MODE)" >> artifacts/recap.log
  # → Step 4 (Phase 2 Execute) へ進行
else
  case "$MODE" in
    auto)
      echo "[PEV] Gate A: auto mode — proceeding to Phase 2"
      # → Step 4 (Phase 2 Execute) へ自動進行
      ;;
    plan)
      echo "[PEV] Gate A: plan mode — STOP. Plan phase complete. Pipeline terminated."
      cat artifacts/plan.md
      exit 0
      ;;
    default|*)
      echo "[PEV] Gate A: default mode — STOP. Plan phase complete."
      echo "[PEV] DO NOT auto-proceed to Phase 2. Review plan.md and run /pev-execute to continue."
      echo "[PEV] (Explicit override available: re-run with --force-auto flag.)"
      cat artifacts/plan.md
      exit 0
      ;;
  esac
fi
```

**executor 起動条件 (Step 4 へ進む条件)**:

- `permissionMode == "auto"` または `--force-auto` フラグ指定。 それ以外 (default / plan / 未設定 かつ flag なし) では **必ず exit 0** で停止する
- agent が「ユーザー意図」を理由に Step 4 へ進むことは禁止 (rules/pev-conventions.md §0 Gate respect)
- ユーザーが続行したい時は (a) `/pev-execute` を打つ、 (b) `permissionMode` を `auto` に変更、 (c) `--force-auto` フラグで explicit override (v1.6+)

### `--force-auto` の使い分け (v1.6+)

- **適切**: dog food / regression test、 CI 自動化、 信頼できる軽微タスク
- **不適切**: production-impacting な変更、 first-time skill 利用、 user が結果を見ずに進める手抜き
- 規約: planner 自身が override を判断するのは引き続き禁止。 ユーザー (or 上位 command) が **explicit に flag を立てる** ことが必須。 dog food log (v1.4+v1.5、 finding 4) で発覚した「prompt 自然言語での transgress」 を formal channel に置き換える。

### Step 4 — Phase 2 (Execute)

executor agent (model: sonnet, effort: high) を起動 (`--parallel` 時は最大3並列)。
コード変更 + `artifacts/execute.log` 記録。

### Step 5 — Gate B (Stop hookで自動)

Stop hook が `artifacts/execute.log` 存在を検出し、recap.log にPhase 2完了エントリ追記 + `/pev-verify` を促す。

### Step 6 — Phase 3 (Verify)

verifier agent。`--strict` 指定時は `pev-dual-review` skill 経由でReviewer A/B並列。
`artifacts/verify.json` 出力。

### Step 7 — Retry Gate

```bash
VERDICT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8')).verdict)" 2>/dev/null)
RETRY=$(cat artifacts/.retry_count 2>/dev/null || echo 0)
MAX=${PEV_MAX_RETRIES:-3}

case "$VERDICT" in
  PASS)
    echo "[PEV] Verdict: PASS — task complete"
    echo "[$(date -u +%FT%TZ)] Task complete (verdict: PASS, retries: $RETRY)" >> artifacts/recap.log
    ;;
  FAIL)
    if [ "$RETRY" -lt "$MAX" ]; then
      echo $((RETRY + 1)) > artifacts/.retry_count
      echo "[PEV] Verdict: FAIL — retry $((RETRY + 1))/$MAX, re-invoking planner"
      # → Step 2 へループ
    else
      echo "[PEV] Verdict: FAIL after $MAX retries — ESCALATING"
      echo "[PEV] Run /pev-status --escalate"
    fi
    ;;
esac
```
