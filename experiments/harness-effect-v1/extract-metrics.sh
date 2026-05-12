#!/usr/bin/env bash
# stream-json から効率軸メトリクスを抽出
# 出力: reports/metrics.json
#
# 抽出項目:
#   - assistant_turn_count  : type=assistant の message 数
#   - tool_use_count        : tool_use block 数
#   - total_input_tokens    : usage.input_tokens 累計
#   - total_output_tokens   : usage.output_tokens 累計
#   - total_cache_read      : usage.cache_read_input_tokens 累計
#   - total_cache_creation  : usage.cache_creation_input_tokens 累計
#   - elapsed_seconds       : start_end.txt から
#
# 依存: jq

set -euo pipefail

cd "$(dirname "$0")"

if ! command -v jq >/dev/null 2>&1; then
  echo "[extract-metrics] jq が必要です (brew install jq)" >&2
  exit 1
fi

extract_one() {
  local name="$1"
  local jsonl="logs/$name.stream.jsonl"
  local timing="logs/$name.start_end.txt"

  if [[ ! -f "$jsonl" ]]; then
    echo "{\"error\":\"$jsonl not found\"}"
    return
  fi

  # type=assistant の最終 usage (累計値) を取る — stream-json は累計で報告される
  local turns input_tok output_tok cache_read cache_create tool_uses elapsed

  turns=$(jq -s '[.[] | select(.type == "assistant")] | length' "$jsonl" 2>/dev/null || echo 0)
  tool_uses=$(jq -s '[.[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use")] | length' "$jsonl" 2>/dev/null || echo 0)

  # 各 assistant message の usage を sum (delta 形式の想定)
  input_tok=$(jq -s '[.[] | select(.type == "assistant") | .message.usage.input_tokens // 0] | add // 0' "$jsonl" 2>/dev/null || echo 0)
  output_tok=$(jq -s '[.[] | select(.type == "assistant") | .message.usage.output_tokens // 0] | add // 0' "$jsonl" 2>/dev/null || echo 0)
  cache_read=$(jq -s '[.[] | select(.type == "assistant") | .message.usage.cache_read_input_tokens // 0] | add // 0' "$jsonl" 2>/dev/null || echo 0)
  cache_create=$(jq -s '[.[] | select(.type == "assistant") | .message.usage.cache_creation_input_tokens // 0] | add // 0' "$jsonl" 2>/dev/null || echo 0)

  if [[ -f "$timing" ]]; then
    elapsed=$(grep -oE 'elapsed: [0-9]+' "$timing" | grep -oE '[0-9]+' | head -1 || echo "null")
  else
    elapsed="null"
  fi

  cat <<EOF
{
  "name": "$name",
  "assistant_turn_count": $turns,
  "tool_use_count": $tool_uses,
  "total_input_tokens": $input_tok,
  "total_output_tokens": $output_tok,
  "total_cache_read": $cache_read,
  "total_cache_creation": $cache_create,
  "elapsed_seconds": $elapsed
}
EOF
}

mkdir -p reports

{
  echo "{"
  echo "  \"no_harness\":"
  extract_one no-harness | sed 's/^/    /'
  echo "  ,"
  echo "  \"with_harness\":"
  extract_one with-harness | sed 's/^/    /'
  echo "}"
} > reports/metrics.json

echo "[extract-metrics] reports/metrics.json 生成完了"
cat reports/metrics.json
