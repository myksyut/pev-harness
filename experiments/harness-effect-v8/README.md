# harness-effect-v8 — Triage 精度 tuning (multi-task dog food)

**実施日**: 2026-05-14
**pev-harness version**: v3.0.3
**target**: v3.0 Triage agent の `plan_required` / `plan_skip` 判定 boundary を 6 task で探索

## 方法

各 task について:

1. `/pev-harness:pev <task>` を stream-json input mode で 1 turn だけ起動
2. `artifacts/triage.json` を確認
3. **Plan / Execute / Verify は走らせず close**
4. 判定 (plan_required / plan_skip) + reasoning + ambiguity_signals を記録

つまり Triage agent **だけ** invoke する形 (= multi-task 効率実行)。

## task 設計

| # | task | 期待判定 | 理由 |
|---|---|---|---|
| T1 | README.md の typo 修正: `Plnaer` → `Planner` (実在しない、 dummy として exercise) | plan_skip | 局所 / 自明 |
| T2 | examples/sample-project/README.md に「Node.js 20+」 を 1 行追記 | plan_skip | docs / 明確 |
| T3 | examples/sample-project/src/validation.js に `validatePostalCode` を追加 (= 郵便番号、 既存 phone validator pattern 踏襲) | boundary | 既存 pattern あるが 新規 function、 grey zone |
| T4 | examples/sample-project に 「申込履歴一覧」 画面を追加 | plan_required | 新機能、 UI 詳細未明示 |
| T5 | examples/sample-project の form を React 化 | plan_required | 大規模 refactor、 framework 選択 等 grey zone 多 |
| T6 | examples/sample-project の `validatePhone` を haripai-no-tsuyoi `^\\d{10,11}$` から `+81` 形式対応に拡張 | boundary | 既存 function 拡張、 spec の精度依存 |

## 評価

- 各判定が「期待」 と一致するか
- 一致しない場合は false positive (= 過剰 plan_required) か false negative (= plan_skip 過剰) か
- v3.1+ で Triage directive を refine する判断材料に
