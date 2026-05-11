---
description: Run full Plan-Execute-Verify pipeline for a coding task
---

# /pev

PEV harnessのメインコマンド。Plan → Execute → Verify を順に実行する。

## Usage

```text
/pev <task description>
/pev <task> --strict       # dual review有効化
/pev <task> --parallel     # 独立ファイル変更を並列実行
/pev <linear-issue-url>    # (v1.x) Linear Issueから自動展開
```

## フロー

1. `pev-spec-template` skill で入力を整形 (Goal/Constraints/AC不足なら質問返し)
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

### Step 3 — Gate A (permissionMode判定)

```bash
# .claude/settings.json または settings.local.json から permissionMode を読む
MODE=$(grep -oh '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' \
       .claude/settings.local.json .claude/settings.json 2>/dev/null \
       | head -1 | cut -d'"' -f4)
MODE=${MODE:-default}

case "$MODE" in
  auto)
    echo "[PEV] Gate A: auto mode — proceeding to Phase 2"
    # → Step 4 へ進む
    ;;
  plan)
    echo "[PEV] Gate A: plan mode — terminating after Plan phase"
    cat artifacts/plan.md
    exit 0
    ;;
  *)
    echo "[PEV] Gate A: default mode — review plan.md and run /pev-execute"
    cat artifacts/plan.md
    exit 0
    ;;
esac
```

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
