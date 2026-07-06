---
description: Run only the Verify phase. Validates changes against plan.md acceptance criteria
---

# /pev-verify

変更を検証する。build/type/lint/test を順に実行し、Acceptance Criteria を1つずつチェック。

## Usage

```text
/pev-verify
/pev-verify --strict        # dual review (Reviewer A + B) を実施
```

## 前提条件

- **v3.0+**: `artifacts/plan.md` または `artifacts/triage.json` のいずれかが存在 (= AC / task description の取得元)
- git作業ツリーに変更がある (verifyすべきものがある)

## フロー (hard-coded)

1. `git diff` で変更を取得
2. **v3.0+**: `artifacts/plan.md` があれば Verification strategy + AC を、 なければ (= Mode B、 plan_skip 後) triage.json + cwd の team-conventions.md / README を参照
3. リストされた command を順次実行 (Build / Type check / Lint / Tests)
4. plan.md の各 Acceptance Criteria を ✅/❌ チェック (plan.md なしなら task description + triage.json を AC として)
5. `artifacts/verify.json` に結果書き出し
6. `--strict` 指定時、`pev-dual-review` skill が起動 (Reviewer A=Opus xhigh / B=Sonnet high 並列)
7. 結果サマリ表示

## --strict モード

| Reviewer | model | effort |
|---|---|---|
| A | opus | xhigh |
| B | sonnet | high |

両者 PASS → NICE → ship 可。いずれか FAIL → NAUGHTY → planner に retry 依頼。

### 動作詳細 (v0.4 以降)

`--strict` 指定時、verifier は以下の流れで動く:

1. 通常の verify (build/test/lint/AC check) を**先に**実行し、その結果と git diff を取得
2. `pev-dual-review` skill のプロトコルに従い、**同一メッセージ内で**2 つの Agent tool calls を並列発射:
   - Reviewer A: subagent_type=verifier, model=opus, effort=xhigh
   - Reviewer B: subagent_type=verifier, model=sonnet, effort=high
   - 両者に同じ rubric (PEV標準 + team-conventions.md からの追加) を渡す
3. 両者の structured JSON output を受け取って merge
4. `artifacts/verify.json` に `strict_mode: true` + `reviewer_a` / `reviewer_b` / `merged` セクションを追加して書き出し
5. `merged.agreement_pct` を recap.log に追記 (model diversity の機能確認用)

詳細プロトコル: `skills/pev-dual-review/SKILL.md`。
例: `examples/verify.strict.example.json`。

## FAIL時の自動retry

`PEV_MAX_RETRIES` (default: 3) 回まで自動retry。3回超えたら escalate。

## Session telemetry finalize (v4.3.0+)

`/pev-verify` 単体実行で最終判定 (PASS / escalate) に達した場合も、 `artifacts/session.json` が存在すれば finalize する (= Gate A 停止 → `/pev-execute` → `/pev-verify` の手動 path でも telemetry が完結する)。 手順は `commands/pev.md` Step 8 と同一、 bash 参考実装: `skills/pev-pipeline/references/pev-implementation.md`。

## Implementation note

verify.json の構造 / dual-review の Agent並列起動 / report formatter は v0.4 で実装。詳細は [Issue #4](https://github.com/myksyut/pev-harness/issues/4) / [Issue #5](https://github.com/myksyut/pev-harness/issues/5)。
