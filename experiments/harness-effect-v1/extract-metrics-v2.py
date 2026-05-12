#!/usr/bin/env python3
"""harness-effect-v1 metrics extractor v2 (v2.1.6+)

v1 (extract-metrics.sh) からの追加点:
- subagent invocation を `task_started` で識別、 Phase 1/2/3/Retry の breakdown
- phase 別の turn / tool_use / output_token / cache_creation を集計
- recap.log があれば phase 別 elapsed seconds を抽出

出力: reports/metrics-v2.json

依存: Python 3.10+ (標準ライブラリのみ)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone


HERE = Path(__file__).resolve().parent
LOGS = HERE / "logs"
REPORTS = HERE / "reports"
SCRATCH = HERE / "scratch"


def load_stream(name: str) -> list[dict]:
    path = LOGS / f"{name}.stream.jsonl"
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def parse_phase(desc: str | None) -> str | None:
    """task_started.description から phase name を識別"""
    if not desc:
        return None
    m = re.match(r"Phase\s+(\d)", desc)
    if not m:
        return None
    return {"1": "plan", "2": "execute", "3": "verify"}.get(m.group(1))


def extract_subagent_groups(events: list[dict]) -> dict[str, dict]:
    """task_started を起点に各 subagent invocation の context を集める

    Returns:
        {tool_use_id: {phase, desc, task_id, started_index, ended_index}}
    """
    groups: dict[str, dict] = {}
    for i, ev in enumerate(events):
        if ev.get("type") != "system":
            continue
        if ev.get("subtype") == "task_started":
            tool_use_id = ev.get("tool_use_id")
            if not tool_use_id:
                continue
            groups[tool_use_id] = {
                "phase": parse_phase(ev.get("description")),
                "desc": ev.get("description"),
                "task_id": ev.get("task_id"),
                "started_index": i,
                "ended_index": None,
            }
        elif ev.get("subtype") == "task_notification":
            task_id = ev.get("task_id")
            # task_id で対応する subagent を見つける
            for _, info in groups.items():
                if info["task_id"] == task_id and info["ended_index"] is None:
                    info["ended_index"] = i
                    break
    return groups


def aggregate(events: list[dict], parent_tool_use_id: str | None) -> dict:
    """指定 parent_tool_use_id の assistant message と tool use を集計

    parent_tool_use_id=None なら main session を集計
    """
    turn_count = 0
    tool_use_count = 0
    in_tok = 0
    out_tok = 0
    cache_create = 0
    cache_read = 0

    for ev in events:
        if ev.get("type") != "assistant":
            continue
        if ev.get("parent_tool_use_id") != parent_tool_use_id:
            continue
        turn_count += 1
        msg = ev.get("message") or {}
        usage = msg.get("usage") or {}
        in_tok += usage.get("input_tokens") or 0
        out_tok += usage.get("output_tokens") or 0
        cache_create += usage.get("cache_creation_input_tokens") or 0
        cache_read += usage.get("cache_read_input_tokens") or 0
        for block in msg.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "tool_use":
                tool_use_count += 1

    return {
        "turn_count": turn_count,
        "tool_use_count": tool_use_count,
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "cache_creation_input_tokens": cache_create,
        "cache_read_input_tokens": cache_read,
    }


def parse_recap(name: str) -> dict:
    """scratch/{name}/artifacts/recap.log から phase 別 elapsed を抽出

    Returns:
        {phase: elapsed_seconds, "retries": N, "total_log_span": seconds}
    """
    recap_path = SCRATCH / name / "artifacts" / "recap.log"
    if not recap_path.exists():
        return {"available": False}

    ts_pat = re.compile(r"\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\]\s*(.*)")
    entries: list[tuple[datetime, str]] = []
    for line in recap_path.read_text(encoding="utf-8").splitlines():
        m = ts_pat.match(line.strip())
        if not m:
            continue
        ts = datetime.fromisoformat(m.group(1).replace("Z", "+00:00"))
        entries.append((ts, m.group(2)))

    if not entries:
        return {"available": False}

    result: dict = {"available": True, "entries": []}
    for ts, msg in entries:
        result["entries"].append({"ts": ts.isoformat(), "msg": msg})

    result["total_log_span_seconds"] = int(
        (entries[-1][0] - entries[0][0]).total_seconds()
    )

    retries = sum(1 for _, m in entries if m.startswith("Retry"))
    result["retries"] = retries

    return result


def parse_start_end(name: str) -> dict:
    path = LOGS / f"{name}.start_end.txt"
    if not path.exists():
        return {"elapsed_seconds": None}
    text = path.read_text(encoding="utf-8")
    m = re.search(r"elapsed:\s*(\d+)", text)
    return {"elapsed_seconds": int(m.group(1)) if m else None}


def summarize(name: str) -> dict:
    events = load_stream(name)
    if not events:
        return {"name": name, "error": "stream-json not found"}

    groups = extract_subagent_groups(events)

    # phase 別集計
    phase_totals: dict[str, dict] = {}
    for tool_use_id, info in groups.items():
        phase = info["phase"] or "other-subagent"
        agg = aggregate(events, tool_use_id)
        if phase not in phase_totals:
            phase_totals[phase] = {"invocations": 0, **{k: 0 for k in agg}}
        phase_totals[phase]["invocations"] += 1
        for k, v in agg.items():
            phase_totals[phase][k] += v

    # main session (subagent ではない top-level assistant)
    main = aggregate(events, None)
    main["invocations"] = 1
    phase_totals["main"] = main

    # 合計
    total = {k: 0 for k in main if k != "invocations"}
    for phase, vals in phase_totals.items():
        for k in total:
            total[k] += vals.get(k, 0)

    return {
        "name": name,
        "wall_clock": parse_start_end(name),
        "recap": parse_recap(name),
        "phase_breakdown": phase_totals,
        "total": total,
    }


def main() -> int:
    REPORTS.mkdir(parents=True, exist_ok=True)
    result = {
        "no_harness": summarize("no-harness"),
        "with_harness": summarize("with-harness"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    out = REPORTS / "metrics-v2.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[extract-metrics-v2] {out} 生成完了")
    # 簡易 summary 標準出力
    for side in ("no_harness", "with_harness"):
        side_data = result[side]
        if "error" in side_data:
            print(f"\n[{side}] ERROR: {side_data['error']}")
            continue
        print(f"\n[{side}]")
        print(f"  wall-clock elapsed: {side_data['wall_clock']['elapsed_seconds']}s")
        if side_data["recap"].get("available"):
            print(f"  recap span: {side_data['recap']['total_log_span_seconds']}s, retries: {side_data['recap']['retries']}")
        print(f"  total: turn={side_data['total']['turn_count']}, tool_use={side_data['total']['tool_use_count']}, out_tok={side_data['total']['output_tokens']}")
        for phase, vals in side_data["phase_breakdown"].items():
            inv = vals.get("invocations", 0)
            print(f"  [{phase}] inv={inv} turn={vals['turn_count']} tool_use={vals['tool_use_count']} out_tok={vals['output_tokens']} cache_create={vals['cache_creation_input_tokens']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
