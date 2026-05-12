#!/usr/bin/env bash
# pev-harness effect comparison — parallel runner
#
# 起動方法:
#   ./run.sh                # 通常実行 (2 並行 background)
#   ./run.sh --dry-run      # コマンドを表示するだけ (実行しない)
#
# 出力:
#   ./logs/no-harness.stream.jsonl     (stream-json full output)
#   ./logs/no-harness.start_end.txt    (timestamp + 経過秒)
#   ./logs/with-harness.stream.jsonl
#   ./logs/with-harness.start_end.txt
#   ./scratch/no-harness/                (claude が書いたファイル全部)
#   ./scratch/with-harness/
#
# 評価は実行後に手動 (EVALUATION.md 参照)

set -euo pipefail

cd "$(dirname "$0")"
EXPERIMENT_DIR="$(pwd)"
HARNESS_REPO="${PEV_HARNESS_DIR:-$HOME/pev-harness}"
PROMPT_FILE="$EXPERIMENT_DIR/prompt.txt"
DRY_RUN="${1:-}"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "[run.sh] prompt.txt が見つかりません: $PROMPT_FILE" >&2
  exit 1
fi

PROMPT_BODY="$(cat "$PROMPT_FILE")"

# 各 run 用 scratch ディレクトリ準備 (再実行で完全リセット)
prepare_scratch() {
  local name="$1"
  local dir="$EXPERIMENT_DIR/scratch/$name"
  rm -rf "$dir"
  mkdir -p "$dir"
  cp "$PROMPT_FILE" "$dir/_prompt.txt"   # 参照用 (claude 自身は読み込まないが artifact 保存)
  echo "$dir"
}

NO_HARNESS_DIR="$(prepare_scratch no-harness)"
WITH_HARNESS_DIR="$(prepare_scratch with-harness)"
mkdir -p "$EXPERIMENT_DIR/logs"

# ハーネスあり側 prompt: /pev-harness:pev で wrap + --force-auto
WITH_HARNESS_PROMPT="/pev-harness:pev ${PROMPT_BODY} --force-auto"
NO_HARNESS_PROMPT="${PROMPT_BODY}"

# 共通の claude flag (両者揃える)
COMMON_FLAGS=(
  --print
  --permission-mode bypassPermissions
  --output-format stream-json
  --verbose
  --include-partial-messages
  --model claude-opus-4-7
)

# 起動コマンド組み立て
build_cmd() {
  local name="$1"
  local dir="$2"
  local prompt="$3"
  local extra="$4"  # --plugin-dir 用
  cat <<EOF
cd "$dir" && \\
  ( echo "[\$(date -u +%FT%TZ)] start" > "$EXPERIMENT_DIR/logs/$name.start_end.txt"; \\
    SECONDS=0; \\
    claude ${extra} ${COMMON_FLAGS[*]} "\$(cat <<'PROMPT_EOF'
$prompt
PROMPT_EOF
)" > "$EXPERIMENT_DIR/logs/$name.stream.jsonl" 2> "$EXPERIMENT_DIR/logs/$name.stderr.txt"; \\
    echo "[\$(date -u +%FT%TZ)] end (elapsed: \${SECONDS}s)" >> "$EXPERIMENT_DIR/logs/$name.start_end.txt" )
EOF
}

NO_HARNESS_CMD="$(build_cmd no-harness "$NO_HARNESS_DIR" "$NO_HARNESS_PROMPT" "")"
WITH_HARNESS_CMD="$(build_cmd with-harness "$WITH_HARNESS_DIR" "$WITH_HARNESS_PROMPT" "--plugin-dir $HARNESS_REPO")"

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "===== no-harness ====="
  echo "$NO_HARNESS_CMD"
  echo
  echo "===== with-harness ====="
  echo "$WITH_HARNESS_CMD"
  exit 0
fi

# 並行実行
echo "[run.sh] no-harness と with-harness を並行起動 (background)"
echo "[run.sh] log は ./logs/{no,with}-harness.stream.jsonl"
echo "[run.sh] scratch は ./scratch/{no,with}-harness/"
echo

bash -c "$NO_HARNESS_CMD" &
NO_PID=$!
bash -c "$WITH_HARNESS_CMD" &
WITH_PID=$!

echo "[run.sh] no-harness PID=$NO_PID, with-harness PID=$WITH_PID"
echo "[run.sh] 完了まで待機..."

wait "$NO_PID" && NO_EXIT=0 || NO_EXIT=$?
wait "$WITH_PID" && WITH_EXIT=0 || WITH_EXIT=$?

echo
echo "[run.sh] no-harness exit=$NO_EXIT"
echo "[run.sh] with-harness exit=$WITH_EXIT"
echo "[run.sh] 完了。 次は ./extract-metrics.sh で集計、 評価は EVALUATION.md 参照"
