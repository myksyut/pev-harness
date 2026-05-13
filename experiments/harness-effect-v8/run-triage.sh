#!/usr/bin/env bash
# v8 multi-task Triage 走行 script
# 各 task について /pev を 1 turn 起動、 triage.json を収集
# Plan / Execute / Verify は走らせない (= turn 1 の output で停止)

set -euo pipefail

cd "$(dirname "$0")"
EXP_DIR="$(pwd)"
HARNESS_REPO="${PEV_HARNESS_DIR:-/Users/miyakishota/oss/pev-harness}"

declare -a TASKS=(
  "README.md の typo を修正してください: 'Plnaer' という単語を 'Planner' に直してください。"
  "examples/sample-project/README.md に「Node.js 20+ が必要」 という note を 1 行追記してください。"
  "examples/sample-project/src/validation.js に 'validatePostalCode' (= 郵便番号 validator、 既存の validatePhone と同じ pattern で) を追加してください。"
  "examples/sample-project に「申込履歴一覧」 画面を追加してください。"
  "examples/sample-project のフォームを React 化してください。"
  "examples/sample-project の validatePhone を、 国際電話番号形式 (+81 prefix 等) にも対応するよう拡張してください。"
)

mkdir -p logs reports

for i in 1 2 3 4 5 6; do
  TASK="${TASKS[$((i-1))]}"
  DEST="/tmp/v8-triage-t${i}"
  WRAPPED="/pev-harness:pev ${TASK}"
  INIT=$(jq -nc --arg t "$WRAPPED" '{type:"user",message:{role:"user",content:[{type:"text",text:$t}]}}')

  echo "=== T${i}: ${TASK:0:50}... ==="
  cd "$DEST"
  date -u +%FT%TZ > "$EXP_DIR/logs/t${i}-start.txt"
  echo "$INIT" | claude --plugin-dir "$HARNESS_REPO" \
    --input-format stream-json --output-format stream-json --include-partial-messages \
    --permission-mode bypassPermissions --verbose --model claude-opus-4-7 -p \
    > "$EXP_DIR/logs/t${i}.stream.jsonl" 2>&1
  date -u +%FT%TZ >> "$EXP_DIR/logs/t${i}-start.txt"

  # triage.json を回収
  if [[ -f "$DEST/artifacts/triage.json" ]]; then
    cp "$DEST/artifacts/triage.json" "$EXP_DIR/logs/t${i}-triage.json"
    DECISION=$(jq -r '.decision' "$DEST/artifacts/triage.json")
    echo "  → decision=${DECISION}"
  else
    echo "  → triage.json not generated (= unexpected, check log)"
  fi
done

echo ""
echo "=== Summary ==="
for i in 1 2 3 4 5 6; do
  if [[ -f "$EXP_DIR/logs/t${i}-triage.json" ]]; then
    D=$(jq -r '.decision' "$EXP_DIR/logs/t${i}-triage.json")
    echo "T${i}: ${D}"
  fi
done
