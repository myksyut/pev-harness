# /pev 実装 reference (bash 参考実装)

`commands/pev.md` から v4.2.1 で抽出した bash 参考実装集。 **orchestrator は通常この file を読まない** — 各 Step の規約は commands/pev.md の記述で完結しており、 本 file は該当 path (Linear 併用、 expect-fail fixture 等) に入った時だけ必要箇所を Read する。 規約の正は commands/pev.md / rules/pev-conventions.md。

## Step 1.5 — Triage 判定 (参考実装)

```bash
WITH_PLAN=false
NO_PLAN=false
[[ "$*" == *"--with-plan"* ]] && WITH_PLAN=true
[[ "$*" == *"--no-plan"* ]] && NO_PLAN=true

if [ "$WITH_PLAN" = "true" ]; then
  echo "[PEV] --with-plan: Triage skip、 Plan を必ず起動"
  TRIAGE_DECISION="plan_required"
elif [ "$NO_PLAN" = "true" ]; then
  echo "[PEV] --no-plan: Triage skip、 Plan を必ず skip"
  TRIAGE_DECISION="plan_skip"
else
  echo "[PEV] Phase 0 (Triage): Plan 必要性を判定..."
  invoke_triage_agent "$TASK_DESCRIPTION" "$(pwd)"
  TRIAGE_DECISION=$(jq -r '.decision' artifacts/triage.json 2>/dev/null)
fi

echo "[PEV] Triage decision: $TRIAGE_DECISION"

# task_infeasible の場合は user 通知して停止 (v3.0.5+)
if [ "$TRIAGE_DECISION" = "task_infeasible" ]; then
  REASONING=$(jq -r '.reasoning' artifacts/triage.json 2>/dev/null)
  AMBIGUITY=$(jq -r '.ambiguity_signals[]' artifacts/triage.json 2>/dev/null)
  echo "[PEV] Phase 0 (Triage): task_infeasible — タスクの対象が cwd に見つかりません"
  echo "[PEV] reasoning: $REASONING"
  echo "[PEV] missing targets:"
  echo "$AMBIGUITY" | sed 's/^/  - /'
  echo "[PEV] task description を確認してください、 PEV pipeline は起動しません"
  echo "[$(date -u +%FT%TZ)] Phase 0 (Triage) complete: task_infeasible → exit" >> artifacts/recap.log
  exit 0
fi

if [ "$TRIAGE_DECISION" = "plan_skip" ]; then
  echo "[$(date -u +%FT%TZ)] Phase 0 (Triage) complete: plan_skip → direct Execute" >> artifacts/recap.log
fi
```

## Step 2.5 — Gate L (Linear issue-first、 参考実装)

```bash
# .linear-config.yml の存在 check (Gate A の前 = Triage / Plan の直後)
if [ -f .linear-config.yml ]; then
  # 既に Linear issue がある場合 (= inbound case、 もしくは再実行) は issue 作成 skip
  if [ -f artifacts/linear/issue_id.txt ]; then
    BRANCH=$(cat artifacts/linear/branch_name.txt 2>/dev/null)
    if [ -n "$BRANCH" ]; then
      echo "[PEV] Gate L: 既存 Linear issue branch に checkout: $BRANCH"
      git checkout "$BRANCH" 2>/dev/null || echo "[PEV] Gate L: branch checkout skip (git 管理外 or branch なし)"
    fi
  else
    # issue-first: pev-linear-sync の Direction 1.5 を invoke
    echo "[PEV] Gate L: .linear-config.yml 検出 — 実装前に Linear issue を作成します"
    # pev-linear-sync skill (issue-first direction) を起動:
    #   1. .linear-config.yml から workspace / team.id を読む
    #   2. plan.md (あれば) or task description + triage.json から issue body 組み立て
    #   3. mcp__plugin_linear_linear__save_issue で新規 issue 作成
    #   4. issue の branchName を取得
    #   5. git checkout -b <branchName>
    #   6. artifacts/linear/{issue_id,issue_url,branch_name}.txt + sync_state.json 書き出し
    invoke_pev_linear_sync_issue_first
    BRANCH=$(cat artifacts/linear/branch_name.txt 2>/dev/null)
    echo "[PEV] Gate L: Linear issue 作成完了、 branch=$BRANCH で実装を進めます"
    echo "[$(date -u +%FT%TZ)] Gate L: Linear issue created, branch=$BRANCH" >> artifacts/recap.log
  fi
fi
```

Gate L 規約の詳細 (v3.3.1 配置修正 F_v15_1 の背景、 degraded mode 条件 F_v17_1/F_v17_2、 issue body の組み立て規則、 副作用の許容判断) は本 file と `skills/pev-linear-sync/SKILL.md` 参照:

- **配置 (v3.3.1+)**: Gate A の **前**。 plan_required path では `Plan → Gate L → Gate A`、 plan_skip path では `Triage → Gate L → Execute`
- inbound case (= `/pev <linear-url>`) は既に `issue_id.txt` があるので issue 作成 skip、 branch checkout のみ
- **degraded mode (v3.3.3+、 F_v17_2)**: Linear MCP unavailable / OAuth 未認証 / headless (`-p`) で OAuth 完了不能、 のいずれも warning を出して issue 作成・checkout を skip し pipeline は続行。 headless で OAuth URL を出して停止するのは **禁止** (F_v17_1)
- git 管理外の cwd では branch checkout を skip (= issue 作成のみ)
- Plan が走った場合は plan.md の Goal/Constraints/AC を issue body に、 plan_skip なら task description + triage.json を issue body に
- 副作用: default mode で user が plan review 後に中止しても Linear issue は残る (意味的に問題なし、 手動 archive)

## Step 3 — Gate A (参考実装)

```bash
# .claude/settings.json または settings.local.json から permissionMode を読む
MODE=$(grep -oh '"permissionMode"[[:space:]]*:[[:space:]]*"[^"]*"' \
       .claude/settings.local.json .claude/settings.json 2>/dev/null \
       | head -1 | cut -d'"' -f4)
MODE=${MODE:-default}

FORCE_AUTO=false
[[ "$*" == *"--force-auto"* ]] && FORCE_AUTO=true

if [ "$FORCE_AUTO" = "true" ]; then
  echo "[PEV] Gate A: --force-auto detected — overriding permissionMode=$MODE, proceeding to Phase 2"
  echo "[$(date -u +%FT%TZ)] Gate A overridden by --force-auto (original mode: $MODE)" >> artifacts/recap.log
else
  case "$MODE" in
    auto)
      echo "[PEV] Gate A: auto mode — proceeding to Phase 2" ;;
    plan)
      echo "[PEV] Gate A: plan mode — STOP. Plan phase complete. Pipeline terminated."
      cat artifacts/plan.md; exit 0 ;;
    default|*)
      echo "[PEV] Gate A: default mode — STOP. Plan phase complete."
      echo "[PEV] DO NOT auto-proceed to Phase 2. Review plan.md and run /pev-execute to continue."
      echo "[PEV] (Explicit override available: re-run with --force-auto flag.)"
      cat artifacts/plan.md; exit 0 ;;
  esac
fi
```

## Step 4 — executor mode 解決 (参考実装)

```bash
# --executor-mode flag > PEV_EXECUTOR_MODE env > settings default (codex)
EXECUTOR_MODE=$(echo "$*" | grep -oE -- '--executor-mode=[a-z]+' | head -1 | cut -d= -f2)
EXECUTOR_MODE=${EXECUTOR_MODE:-${PEV_EXECUTOR_MODE:-codex}}
export PEV_EXECUTOR_MODE="$EXECUTOR_MODE"
echo "[PEV] Phase 2 executor mode: $EXECUTOR_MODE"
```

## Step 7 — PASS / 上限到達時の recap (参考実装)

```bash
VERDICT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8')).verdict)" 2>/dev/null)
if [ "$VERDICT" = "PASS" ]; then
  echo "[$(date -u +%FT%TZ)] Task complete via /goal (verdict: PASS)" >> artifacts/recap.log
else
  echo "[$(date -u +%FT%TZ)] /goal handed back after max rounds (verdict: $VERDICT) — /pev-status --escalate" >> artifacts/recap.log
  echo "[PEV] /goal handed back — run /pev-status --escalate"
fi
```

## Step 7 例外 — `--expect-fail` / hooks 無効環境 (参考実装)

```bash
VERDICT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('artifacts/verify.json','utf8')).verdict)" 2>/dev/null)

# user が「このタスクは FAIL することを想定済」を明示するフォーマル channel。
# retry に時間と token を費やさず即 escalate path に流す
EXPECT_FAIL=false
[[ "$*" == *"--expect-fail"* ]] && EXPECT_FAIL=true
if [ "$EXPECT_FAIL" = "false" ] && grep -qE '^\s*expectFail:\s*true\s*$' artifacts/plan.md 2>/dev/null; then
  EXPECT_FAIL=true
  echo "[PEV] expectFail detected in plan.md (treating as --expect-fail)"
fi

case "$VERDICT" in
  PASS)
    if [ "$EXPECT_FAIL" = "true" ]; then
      echo "[PEV] Verdict: PASS but --expect-fail was set — UNEXPECTED PASS (fixture intent broke?)"
      echo "[$(date -u +%FT%TZ)] Unexpected PASS under --expect-fail (review fixture / spec drift)" >> artifacts/recap.log
    else
      echo "[PEV] Verdict: PASS — task complete"
      echo "[$(date -u +%FT%TZ)] Task complete (verdict: PASS)" >> artifacts/recap.log
    fi
    ;;
  FAIL)
    if [ "$EXPECT_FAIL" = "true" ]; then
      echo "[PEV] Verdict: FAIL as expected (--expect-fail) — no retry, escalate path"
      echo "[$(date -u +%FT%TZ)] Expected FAIL recorded (no retry under --expect-fail)" >> artifacts/recap.log
    else
      echo "[PEV] Verdict: FAIL but /goal disabled (hooks off) — no auto-retry available"
      echo "[$(date -u +%FT%TZ)] FAIL with /goal unavailable (hooks off) — manual retry / escalate" >> artifacts/recap.log
    fi
    echo "[PEV] Run /pev-status --escalate"
    ;;
esac
```

## `--expect-fail` の使い分け (v1.8+)

- **適切**: dog food fixture で意図的に retry-exhaust シナリオを exercise するケース、 regression test で「FAIL が現状の正解」 と確定しているケース、 negative test fixture
- **不適切**: 実装中の通常タスク (本来 retry で直る可能性を奪う)、 unknown error の調査
- 規約: `--expect-fail` は **意図的 FAIL の宣言** であり、 retry を skip することによる時間 / token 節約を目的にする。 PASS した場合は「想定外」 として recap.log に warning を残す (fixture intent 崩壊 or spec drift の signal)

## `--force-auto` の使い分け (v1.6+)

- **適切**: dog food / regression test、 CI 自動化、 信頼できる軽微タスク
- **不適切**: production-impacting な変更、 first-time skill 利用、 user が結果を見ずに進める手抜き
- 規約: planner 自身が override を判断するのは引き続き禁止。 ユーザー (or 上位 command) が **explicit に flag を立てる** ことが必須。 dog food log (v1.4+v1.5、 finding 4) で発覚した「prompt 自然言語での transgress」 を formal channel に置き換える
