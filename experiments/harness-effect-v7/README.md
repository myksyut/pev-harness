# harness-effect-v7 — Mode B (plan-less) 初検証

**実施日**: 2026-05-14
**pev-harness version**: v3.0.2 (commit f699ab5 時点)
**target**: v3.0 で導入した **Mode B (plan-less Execute)** が実機で動くか初検証
**precedessor**: v6 までは全 task が plan_required 経路、 plan_skip 経路は未検証

## 観点

v3.0 設計の検証完了度:

| path | 検証 |
|---|---|
| Triage → Plan → Execute → Verify (= plan_required) | ✓ v3-dogfood / v5 / v6 で実証済 |
| Triage → Execute → Verify (= plan_skip、 Mode B) | **✗ 未検証** ← v7 で初検証 |

## task 選び

Triage が `plan_skip` を返しそうな task として、 **docs-only + 既存 pattern に同類記述あり + 明確 spec** を選ぶ:

> 「examples/sample-project/team-conventions.md の `二重送信防止` section に、 「キャンセル操作時も同じ pattern (button disabled + flag) を適用する」 という 1 行を追記してください。」

理由:
- docs-only: コード変更なし、 minimal scope
- 既存 pattern に同類記述あり (= 二重送信防止 section が既にある)
- 明確 spec: 何を書くか具体的、 grey zone なし
- Triage 判定の plan_skip 寄り signal を多く持つ

## 期待挙動

1. **Phase 0 Triage**: `plan_skip` 判定 (= 既存 codebase + spec 明確 + 1 行追記)
2. **Phase 2 Execute (Mode B)**: plan.md なしで task description + cwd context を読んで実装
3. **Phase 3 Verify**: plan.md なし、 task description + triage.json から AC を組んで verify

## 観察したい点

- Triage が plan_skip を出すか (= 判定精度)
- Mode B Execute が user prompt + cwd を直接読んで正しく実装できるか
- Verifier が plan.md なしで verify できるか
- 効率: plan_skip の方が plan_required より顕著に速いか
