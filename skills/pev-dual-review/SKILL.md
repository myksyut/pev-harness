---
name: pev-dual-review
description: --strict モード専用。Reviewer A (Opus xhigh) と Reviewer B (Sonnet high) の独立2人レビュー。両者PASSで初めてship
---

# pev-dual-review

`--strict` モードで起動される検証強化skill。santa-method の軽量版。**外部CLI依存ゼロ**、Claude単独で model alias diversity を実現する。

## When to Use

- `/pev <task> --strict` 指定時
- main / release ブランチへの merge前
- 顧客向けリリース、security-criticalな変更
- `PEV_STRICT_MODE=true` がset されているプロジェクト

通常タスクには使わない (token コスト2〜3倍)。

## How It Works

### アーキテクチャ

```
                   verify (通常)
                        │
                        ▼
              ┌─────────────────────┐
              │ artifacts/verify.json│
              └──────────┬──────────┘
                         │
              VERIFY PASS │ VERIFY FAIL → 通常retry loop
                         ▼
              ┌─────────────────────┐
              │  --strict 有効?     │
              └──────────┬──────────┘
                  YES   │   NO → ship
                         ▼
        ┌────────────────┴───────────────┐
        ▼                                ▼
   [Reviewer A]                    [Reviewer B]
   model: opus                     model: sonnet
   effort: xhigh                   effort: high
   独立 context                    独立 context
        │                                │
        └────────────────┬───────────────┘
                         ▼
                   両者PASS?
                   ├── YES → SHIP
                   └── NO  → 全issue merge → planner retry
```

### Reviewer A と B の差別化

| | Reviewer A | Reviewer B |
|---|---|---|
| model | `claude-opus-4-7` | `claude-sonnet-4-6` |
| effort | xhigh | high |
| tools | Read, Bash, Grep | Read, Bash, Grep |
| focus | アーキ的妥当性 / 設計違反 | 実装の正しさ / edge cases |

両者は同じrubricを使うが、modelの能力差から自然に異なる blind spotを持つ。

### 独立性の担保

1. **並列起動**: 同一メッセージ内で2つのAgent toolを同時呼び出し
2. **互いの結果を見せない**: subagentの context は独立
3. **同一 rubric**: 同じ評価基準
4. **Fresh agents each round**: retry時は agent を作り直す

### Rubric (PEV標準)

| Criterion | Pass Condition |
|---|---|
| Acceptance Criteria | plan.md の全AC が満たされている |
| Build/Test/Lint | 全てPASS |
| Security | OWASP Top 10 / secret leak / injection なし |
| 既存挙動 | regression を導入していない |
| Diff scope | plan.md にない drive-by変更がない |
| Code clarity | reviewabilityが高い (関数名、責任分割) |

プロジェクト固有rubricは `team-conventions.md` の `## Review Rubric` セクションで追加可能。

### Verdict gate

- Both PASS → NICE → ship
- Either FAIL → NAUGHTY → 全issueをdedupedして planner にretry依頼
- 最大 3 round

## Implementation

```python
# pseudocode (実体は /pev-verify --strict 内で実行)
def dual_review(artifacts_dir, rubric):
    reviewer_a = Agent(
        description="PEV Reviewer A (Opus)",
        subagent_type="verifier",
        prompt=build_review_prompt(artifacts_dir, rubric, role="A"),
        model="opus",
        effort="xhigh",
    )
    reviewer_b = Agent(
        description="PEV Reviewer B (Sonnet)",
        subagent_type="verifier",
        prompt=build_review_prompt(artifacts_dir, rubric, role="B"),
        model="sonnet",
        effort="high",
    )
    # 同一メッセージで並列起動
    result_a, result_b = run_parallel(reviewer_a, reviewer_b)

    if result_a.verdict == "PASS" and result_b.verdict == "PASS":
        return "NICE"
    
    merged_issues = dedupe(result_a.issues + result_b.issues)
    return "NAUGHTY", merged_issues
```

### Reviewer prompt template

```
You are an independent quality reviewer for the PEV harness.
You have NOT seen any other review of this output.

## Task spec
<plan.md>

## Changes under review
<git diff>

## Verification results
<verify.json>

## Rubric
<rubric>

## Your role
Reviewer [A|B]. Your job is to find problems, not to approve.

## Output
Return structured JSON:
{
  "verdict": "PASS|FAIL",
  "checks": [{"criterion": "...", "result": "PASS|FAIL", "detail": "..."}],
  "critical_issues": ["..."],
  "suggestions": ["..."]
}
```

## Model diversityの限界

両 reviewer が同じ Claude family のため、完全な model diversity ではない:

- 同じトレーニングデータ由来の blind spot を共有する
- 同じ系統の hallucination パターンに陥る可能性

許容トレードオフ:
- ✅ 外部CLI依存ゼロ (社内ツールチェーン制約をクリア)
- ✅ Plugin単独で完結
- ❌ 真の独立性は妥協

v2.0で MCP server経由の外部model (OpenAI/Gemini) 対応を検討。

## Examples

### 典型的な NICE 結果

```
[Phase 3 --strict]
Reviewer A (Opus xhigh):  PASS
Reviewer B (Sonnet high): PASS

Agreement: 100%
Verdict: NICE → ship
```

### NAUGHTY → retry の例

```
[Phase 3 --strict, round 1]
Reviewer A (Opus xhigh):  FAIL
  - Critical: JWT secret hardcoded in src/auth/jwt.ts:23
Reviewer B (Sonnet high): FAIL
  - Critical: Missing input validation in middleware

Merged issues (2):
  1. JWT secret hardcoded
  2. Missing input validation

→ planner にretry依頼 (round 2)
```

## 注意点

- token コストは通常verify の 2〜3倍 (両reviewer + retry分)
- 短いタスクには使わない (overhead比率が高すぎる)
- rubric が緩いと rubber stamping が起きる → 定期的にrubricを引き締める
- 3 round 超えても NAUGHTY → 人間escalate、自動continueしない
