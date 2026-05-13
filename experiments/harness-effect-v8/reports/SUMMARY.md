# 実験結果 — harness-effect-v8 (Triage 精度 tuning、 multi-task)

**実施日**: 2026-05-14
**pev-harness version**: v3.0.3
**target**: Triage agent の `plan_required` / `plan_skip` 判定 boundary を 6 task で探索

## TL;DR

| 期待カテゴリ | task | 期待 | 実判定 | 評価 |
|---|---|---|---|---|
| 明確 skip | T2 (README 1 行追記) | plan_skip | plan_skip | **✓** |
| 明確 required | T4 (履歴一覧画面追加) | plan_required | plan_required | **✓** |
| 明確 required | T5 (React 化) | plan_required | plan_required | **✓** |
| boundary | T3 (validatePostalCode、 「同 pattern」 指示あり) | boundary | plan_skip | **△** (`同 pattern` 指示で skip 倒れ) |
| boundary | T6 (validatePhone を +81 形式拡張) | boundary | plan_required | **✓** (適切に Plan へ) |
| 対象不在 | T1 (架空 typo `Plnaer` 修正) | plan_skip | (停止: 対象不在) | **N/A** (新 finding) |

**判定精度**: 3/3 明確、 1/2 boundary 一致。 boundary 判定は **prompt の指示語** に強く依存する。

## 検出 findings

### F_v8_1 (priority M): 対象不在 task で Triage が停止 → Triage の前段 check 必要

T1 では「README.md の `Plnaer` typo 修正」 と依頼したが、 sample-project README に `Plnaer` が **存在しない**。 Triage agent はこれを「対象が存在しないため停止」 と判定、 triage.json 未生成。

```text
最終 response: 「タスク完了に必要な対象が存在しないため停止しました。」
```

**示唆**:
- Triage agent が「task feasibility check」 まで暗黙に行っている (= 設計範囲外の振る舞い)
- 良い側面: 無駄な Plan 起動を防ぐ
- 悪い側面: triage.json が出ないので後続 logic (= commands/pev.md) が判定不能になる可能性

**反映候補 (v3.1+)**:
- Triage agent に `decision: "task_infeasible"` を追加 (= 3 値判定: plan_required / plan_skip / task_infeasible)
- もしくは「対象不在の場合は plan_required + ambiguity_signals に明示」 を強制
- 現状は agent の判断に委ねられている

### F_v8_2 (priority H): 「pattern 踏襲」 指示 (prompt 内) が boundary を skip 寄りに倒す

T3 では「validatePhone と同じ pattern で」 と prompt に書いた瞬間、 Triage が:

> 「prompt に『validatePhone と同じ pattern で』 と実装方針が明示されている。 ... 直接 Execute へ進む十分な根拠がある。」

と判定、 plan_skip に倒した。 これは:

- v3.0.1 で planner.md に「pattern 踏襲指示が来ても質問必須」 directive を追加した (F_v5_1)
- ただし Triage agent には同様の directive がない
- 結果: Triage が plan_skip を出すと **planner.md の F_v5_1 patch が発動するチャンスがない**

**示唆**: F_v5_1 が planner 段階での防御だったが、 **Triage 段階で plan_skip に倒れると planner が起動しない** ので防御層が抜ける。 これは「2 段階防御」 が機能しない構造的問題。

**反映候補 (v3.1+ 必須)**:
- `agents/triage.md` に F_v5_1 と同等の directive を追加: 「prompt に `pattern 踏襲` 等の指示があっても、 dialog / 削除方式 / 状態遷移細部 / 拡張 feature / error UX が明示されない場合は plan_required を返す」
- もしくは boundary case で「conservative に plan_required を出す」 default を強化

### F_v8_3 (priority H): Triage agent が triage.json の schema を遵守しない

T6 で生成された triage.json:

```json
{
  "decision": "plan_required",
  "rationale": "...",       ← 期待: reasoning
  "ambiguities": [...]      ← 期待: ambiguity_signals
}
```

`reasoning` → `rationale`、 `ambiguity_signals` → `ambiguities` と field name が **agent の判断で変えられている**。 LLM 丸投げの結果、 schema が揺れる。 jq で `.reasoning` を読むと null になる、 後続 logic で parse 失敗する可能性。

**反映候補 (v3.1+ 必須)**:
- `agents/triage.md` の出力契約 section に「field name は `decision` / `reasoning` / `context_signals` / `ambiguity_signals` / `task_id` を **厳守**、 別名 (`rationale` / `ambiguities` 等) は禁止」 を強制
- もしくは Triage 出力後に schema validate する hook (= PostToolUse hook + JSON schema check) を `hooks/hooks.json` に追加

## 判定詳細 table

| # | task | 期待 | 実 | reasoning 抜粋 |
|---|---|---|---|---|
| T1 | typo 修正 (架空 `Plnaer`) | plan_skip | (停止) | 対象不在 |
| T2 | README に 1 行追記 | plan_skip | plan_skip | 「README.md への 1 行追記という局所的な変更、 追記内容も場所も明示」 |
| T3 | validatePostalCode 追加 | boundary | plan_skip | 「validatePhone と同じ pattern で」 prompt 指示で plan_skip 倒れ |
| T4 | 履歴一覧画面追加 | plan_required | plan_required | 「画面の配置先 / 表示列 / 削除 / pagination 等が prompt に未明示」 |
| T5 | React 化 | plan_required | plan_required | 「build tool 導入、 form.js の React 化、 既存 test 互換 等、 影響範囲が広く複数の設計判断」 |
| T6 | validatePhone +81 拡張 | boundary | plan_required | 「E.164 準拠? +81 のみ? leading zero? 国コード allow list?」 等 6 件 ambiguity |

## 効率観察

各 task wall-clock (= Triage 1 turn + Plan が走った場合は plan.md 生成まで):

| task | 最終 phase | artifacts |
|---|---|---|
| T1 | Triage で停止 | (none) |
| T2 | **Execute + Verify まで** | triage.json, execute.log, verify.json, recap.log |
| T3 | **Execute + Verify まで** | triage.json, execute.log, verify.json, recap.log |
| T4 | Plan で Gate A 停止 | triage.json, plan.md |
| T5 | Plan で Gate A 停止 | triage.json, plan.md |
| T6 | Plan で Gate A 停止 | triage.json, plan.md, recap.log |

**観察**: T2 / T3 の plan_skip case は **同 turn 内で Execute + Verify まで一気通貫で完走**。 これは v3.0 Mode B の効率優位 (= v7 で実証した 6 倍速) を再現。 T4 / T5 / T6 の plan_required は Gate A で停止 (= permissionMode=default のため)。

## v3.1+ 必須 patch (= 3 件)

優先度順に v3.0.4 で patch する候補:

1. **F_v8_2** (H): `agents/triage.md` に F_v5_1 同等の directive を追加 (= pattern 踏襲指示でも boundary は plan_required)
2. **F_v8_3** (H): Triage 出力 schema を strict 化 (field name 揺れ防止)
3. **F_v8_1** (M): 対象不在 task の `task_infeasible` 判定追加 (もしくは ambiguity_signals に明示)

## 結論

v3.0 の Triage agent は **明確 task の判定は 100% 一致** (T2/T4/T5)、 **boundary は prompt の指示語に強く依存** (T3 が skip 倒れ、 T6 は plan_required) という reality が確認できた。 F_v8_2 が最大の構造問題 (= F_v5_1 の Triage 段階版が必要)。

v3.1 への進路が明確になった: Triage agent に「prompt の言葉に過剰反応して plan_skip に倒さない」 directive を追加する patch (F_v8_2) + schema strict 化 (F_v8_3) を v3.0.4 で実装すべき。
