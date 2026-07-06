---
name: pev-dual-review
description: --strict モード専用。Reviewer A (Opus xhigh、固定) と Reviewer B (Sonnet high / Codex CLI から選択) を並列起動し、両者の structured JSON verdict を merge して NICE/NAUGHTY 判定。v2.0 で Reviewer B が選択可能になり、 dual-codex mode (codex CLI subprocess) で真の external model diversity を実現
---

# pev-dual-review

`--strict` モードで起動される検証強化 skill。santa-method の軽量版。 v1.x までは Claude 単独 model alias、 v2.0 で Reviewer B を **OpenAI Codex CLI subprocess** に切替可能。

## v2.0 reviewer mode (3 種)

| Mode | Reviewer A | Reviewer B | 起動 path |
|---|---|---|---|
| `dual-claude` (v1.x default、 `--strict` 旧挙動) | claude opus (xhigh) | claude sonnet (high) | 同一メッセージ内の Agent tool 2 並列 |
| **`dual-codex`** (v2.0 新規) | claude opus (xhigh) | codex CLI subprocess | Agent tool + Bash subprocess を同一メッセージ内で並列起動 (本 skill が Reviewer A、 `pev-external-reviewer` skill が Reviewer B) |
| `codex-only` (v2.0 新規、 cost 削減 path) | (なし) | codex CLI subprocess 単独 | 本 skill は起動しない、 verifier から `pev-external-reviewer` のみ起動 |

mode 切替方法 (priority 高い順):

1. `/pev <task> --reviewer-mode=<mode>` (CLI flag)
2. `.claude/settings.local.json` の env `PEV_REVIEWER_MODE`
3. settings.json default (= `claude-only`、 本 skill 起動しない)

Reviewer A が **opus 固定** の理由: ADR-007 (SPEC.md §12) — plan-aware role (plan.md 理解 + AC trace) は claude 側に固定して、 codex は fresh perspective として独立に機能させる。

## When to Use

- `/pev <task> --strict` 指定時
- `/pev-verify --strict` 直接呼び出し時
- main / release ブランチへの merge 前
- `PEV_STRICT_MODE=true` がプロジェクトで設定済み

通常タスクには使わない (token コスト 2〜3倍)。

## How It Works

### アーキテクチャ

```text
                   /pev-verify --strict
                        │
                        ▼
              ┌─────────────────────┐
              │ verifier が判定:    │
              │ --strict なら       │
              │ Reviewer A/B 起動   │
              └──────────┬──────────┘
                         │
        ┌────────────────┴───────────────┐
        ▼                                ▼
   [Reviewer A]                    [Reviewer B]
   model: opus                     model: sonnet
   effort: xhigh                   effort: high
   subagent: verifier              subagent: verifier
   独立 context                    独立 context
        │                                │
        └────────────────┬───────────────┘
                         ▼
                 verifier が JSON merge:
                 - 両者PASS    → NICE   → write verify.json
                 - いずれかFAIL → NAUGHTY → critical_issues
                                             dedupe + merge
                                             → planner retry
```

### 並列起動の実装

Claude Code agent (verifier) は `--strict` を検知したら、**同一メッセージ内で2つの Agent tool calls を発射する**:

```text
[verifier message content]

I will spawn two independent reviewers in parallel.

<Agent tool call 1>
  description: PEV Reviewer A (Opus xhigh)
  subagent_type: verifier
  model: opus
  prompt: |
    You are an independent quality reviewer for the PEV harness.
    You have NOT seen any other review of this output.

    ## Task spec
    {paste .pev-artifacts/plan.md}

    ## Changes under review
    {paste git diff output}

    ## Rubric
    {paste rubric (see below)}

    ## Your role
    Reviewer A. Find problems, do not approve.

    ## Output
    Return structured JSON with this exact shape:
    {
      "reviewer": "A",
      "verdict": "PASS|FAIL",
      "checks": [{"criterion": "...", "result": "...", "detail": "..."}],
      "critical_issues": ["..."],
      "suggestions": ["..."]
    }

<Agent tool call 2>
  description: PEV Reviewer B (Sonnet high)
  subagent_type: verifier
  model: sonnet
  prompt: |
    [same as Reviewer A but with "Your role: Reviewer B"]
```

Claude Code が 2つの Agent tool calls を同一メッセージ内で発射すると、両者は並列実行され、context isolation も保たれる。

### Reviewer A と B の差別化

| | Reviewer A | Reviewer B |
|---|---|---|
| model | `claude-opus-4-8` | `claude-sonnet-4-6` |
| effort | xhigh | high |
| 強み | アーキ妥当性 / 設計違反 / 微妙な抽象化エラー | 実装の正しさ / edge cases / 機械的なミス |

両者は同じrubricを使うが、modelの能力差から自然に異なる blind spotを持つ。

## Rubric (PEV標準)

| Criterion | Pass Condition |
|---|---|
| Acceptance Criteria | plan.md の全AC が満たされている |
| Build/Test/Lint | 全てPASS |
| Security | OWASP Top 10 / secret leak / injection なし |
| 既存挙動 | regression を導入していない |
| Diff scope | plan.md にない drive-by変更がない |
| Code clarity | reviewabilityが高い (関数名、責任分割) |

プロジェクト固有 rubric は `team-conventions.md` の `## Review rubric` セクションに追加で書ける。`pev-team-conventions` skill が自動注入する。

## JSON Merge ロジック

verifier (親) が両 reviewer の JSON を受け取った後:

```text
# 擬似コード (verifier agent が実行)

review_a = parse_json(reviewer_a_output)
review_b = parse_json(reviewer_b_output)

if review_a.verdict == "PASS" and review_b.verdict == "PASS":
    final_verdict = "NICE"
else:
    final_verdict = "NAUGHTY"

# critical_issues を dedupe + merge
all_issues = review_a.critical_issues + review_b.critical_issues
merged_issues = dedupe_by_substring(all_issues)
# (例: "JWT secret hardcoded in jwt.ts:23" と "JWT secret hardcoded" は1つにまとめる)

# agreement率を計算
common = issues_intersection(review_a.critical_issues, review_b.critical_issues)
agreement_pct = len(common) / max(len(all_issues), 1) * 100

# verify.json に reviewer_a / reviewer_b セクション追加
write_verify_json({
    "verdict": "PASS" if final_verdict == "NICE" else "FAIL",
    "strict_mode": True,
    "reviewer_a": review_a,
    "reviewer_b": review_b,
    "merged": {
        "critical_issues": merged_issues,
        "agreement_pct": agreement_pct
    },
    ...
})
```

## Verdict Gate

- Both PASS → NICE → ship 可
- Either FAIL → NAUGHTY → merged critical_issues を planner に retry依頼
- Max 3 round

## Reviewer prompt template (完成版)

verifier (親) が両 reviewer に渡す prompt の共通部:

```text
You are an independent quality reviewer for the PEV harness.
You have NOT seen any other review of this output. Find problems,
not approval.

## Task spec
<inserted plan.md>

## Changes under review (git diff)
<inserted git diff>

## Verification commands and results
<inserted: build/test/lint output captured by verifier parent>

## Rubric
<inserted rubric, including team-conventions.md additions if present>

## Your role
You are Reviewer {A|B}. Your model is {opus|sonnet}, your effort
is {xhigh|high}.

## Output format
Return ONLY valid JSON with this shape:

{
  "reviewer": "A" | "B",
  "verdict": "PASS" | "FAIL",
  "checks": [
    {"criterion": "<from rubric>", "result": "PASS|FAIL", "detail": "<evidence>"}
  ],
  "critical_issues": ["<blocker if any>"],
  "suggestions": ["<non-blocking improvement>"]
}

Do not include any text outside the JSON.
```

## Model diversityの限界

両 reviewer が同じ Claude family のため、完全な model diversity ではない:

- 同じトレーニングデータ由来の blind spot を共有する
- 同じ系統の hallucination パターンに陥る可能性

許容トレードオフ:

- ✅ 外部CLI依存ゼロ (社内ツールチェーン制約をクリア)
- ✅ Plugin単独で完結
- ❌ 真の独立性は妥協

v2.0 (Issue #9) で MCP server経由の外部model (OpenAI/Gemini) 対応を検討。

## Examples

### NICE (両者PASS)

```json
{
  "verdict": "PASS",
  "strict_mode": true,
  "reviewer_a": { "verdict": "PASS", "critical_issues": [], ... },
  "reviewer_b": { "verdict": "PASS", "critical_issues": [], ... },
  "merged": { "critical_issues": [], "agreement_pct": 100 }
}
```

### NAUGHTY (両者が異なる issue を発見)

```json
{
  "verdict": "FAIL",
  "strict_mode": true,
  "reviewer_a": {
    "verdict": "FAIL",
    "critical_issues": ["JWT secret hardcoded in src/auth/jwt.ts:23"]
  },
  "reviewer_b": {
    "verdict": "FAIL",
    "critical_issues": ["Missing input validation in middleware"]
  },
  "merged": {
    "critical_issues": [
      "JWT secret hardcoded in src/auth/jwt.ts:23",
      "Missing input validation in middleware"
    ],
    "agreement_pct": 0
  },
  "next_action": "Trigger planner retry with merged critical_issues"
}
```

agreement_pct が低いほど reviewer の独立性が機能している証拠 (両方が同じ穴を見ているなら model diversity の意義が薄い)。

## 注意点

- token コストは通常verify の 2〜3倍 (両reviewer + retry分)
- 短いタスクには使わない (overhead比率が高すぎる)
- rubric が緩いと rubber stamping が起きる → 定期的にrubricを引き締める
- 3 round 超えても NAUGHTY → 人間escalate、自動continueしない
- merged.agreement_pct == 100 が連続したら rubric の差別化が不十分 → rubric見直し
