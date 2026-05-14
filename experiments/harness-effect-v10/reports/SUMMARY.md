# 実験結果 — harness-effect-v10 (F_v8_1/2 dog food verify、 真 task)

**実施日**: 2026-05-14
**pev-harness version**: v3.0.4
**target**: v3.0.4 で残り未 verify だった 2 patch を真の task で verify
**predecessor**: v9 (= F_v8_3 schema verify、 plan_skip 正解 case)

## TL;DR

| patch | task | 結果 |
|---|---|---|
| **F_v8_2** (pattern 踏襲 conservative) | t-boundary (validatePostalCode、 spec 細部 全省略) | **✓ plan_required + ambiguity 6 件 + plan.md 確認質問 5 件** |
| **F_v8_1** (task_infeasible) | t-infeasible (src/auth.js bug 修正、 file 不在) | **✗ triage.json 未生成、 main session で停止判定** → 新 finding F_v10_1 |

## T-boundary (F_v8_2 完璧 verify)

prompt: `examples/sample-project/src/validation.js に validatePostalCode を追加してください。` (= spec の細部すべて省略、 pattern 指示なし)

triage.json:

```json
{
  "decision": "plan_required",
  "reasoning": "validatePostalCode の必須/任意・郵便番号フォーマット仕様 (ハイフン許容可否等)・validateForm aggregate への組み込み有無・index.html および tests への影響範囲・error message 文言がすべて prompt に未明示。 既存 validatePhone という参照 pattern はあるが、 pattern 踏襲の明示もなく、 仕様の重要領域が未確定のため Plan で確認質問が必要。",
  "context_signals": [...],
  "ambiguity_signals": [
    "validatePostalCode が必須か任意か未明示",
    "郵便番号フォーマット仕様未指定",
    "validateForm aggregate への組み込み有無が未明示",
    "index.html への field 追加要否が未明示",
    "tests/validation.test.js への境界値テスト追加要否が未明示",
    "error message 文言が未指定"
  ],
  "task_id": "..."
}
```

**注目**: ambiguity_signals が **6 件** で適切に捕捉、 reasoning に「pattern 踏襲の明示もなく」 が明示。 v3.0.4 patch directive の boundary 判定 (= pattern 踏襲指示でも dialog/削除方式/etc 未明示なら plan_required) が functional。

その後 planner が起動して plan.md に確認質問 5 件 + default 解釈 + AC 15 件を出力、 Gate A で停止。

### v9 (pattern 指示あり、 spec 細部 明示) との対比

| 観点 | v9 (validatePostalCode + pattern 指示 + 細部明示) | v10 t-boundary (細部 全省略) |
|---|---|---|
| Triage decision | plan_skip | **plan_required** |
| ambiguity_signals 数 | 0 | **6** |
| 後続 phase | Execute 直行 | planner で確認質問 |

**同じ function 追加 task でも、 prompt の spec 詳細度で Triage が適切に分岐**。 v3.0.4 patch が boundary 判定で正しく functional。

## T-infeasible (F_v8_1 部分 verify、 patch 不足発覚)

prompt: `src/auth.js の token validation bug を修正してください。 expired token が 200 を返す問題があります。`

`src/auth.js` は sample-project に存在しない (= 対象不在 task)。

期待挙動: Triage が `task_infeasible` decision を triage.json に出力、 main が user 通知して停止

実挙動:
- triage.json **未生成** (= artifacts/ 空)
- main session の最終応答: 「PEV pipeline は起動せず停止しました。 タスクが referencing する `src/auth.js` がこの fixture には存在しないため、 ユーザー確認を待ちます。」

つまり main session (= /pev command 経由) が **triage agent を起動する前に自走で「対象不在 → 停止」 と判定**。 triage.md に書いた `task_infeasible` decision は発動するチャンスがない。

### F_v10_1 (priority H): patch を agent prompt だけに書いても main flow が受領しないと不発動

triage.md に `task_infeasible` decision を追加 (= F_v8_1 patch) しても、 **commands/pev.md の main flow に「triage.json を読んで decision で分岐する」 logic** がないと:

- main session が triage agent invoke 自体を skip して自走判定
- 結果として patch が agent prompt として書いてあるだけで dead code

**反映候補 (v3.0.5)**:
- `commands/pev.md` Step 1.5 (Triage) に「triage 起動前に task feasibility check は行わない、 必ず triage agent を invoke する」 directive
- もしくは triage agent invoke 後の decision parse step で `task_infeasible` の場合の停止 logic + user 通知 path を追加
- どちらか (もしくは両方) を v3.0.5 patch として実装

## v3.0.4 patch effect の最終評価

| patch | 検証 status | comment |
|---|---|---|
| F_v8_3 (schema 厳守) | ✓ v9 + v10 で確認 | functional |
| F_v8_2 (pattern 踏襲 conservative) | ✓ v9 + v10 で確認 | v9 で「真の明確 task は plan_skip 維持」、 v10 で「真の boundary は plan_required」 という適切な分岐 |
| F_v8_1 (task_infeasible) | ✗ patch 不足 (F_v10_1) | triage.md だけでなく commands/pev.md 統合が必要 |

## 次の patch (v3.0.5 候補)

- **F_v10_1**: `commands/pev.md` に Triage の `task_infeasible` decision 受領 logic 追加
- もしくは triage agent invoke を必ず最初に行う directive を main flow に書く

## 結論

v3.0.4 の 3 patch のうち 2 件 (F_v8_2 + F_v8_3) は完璧に functional。 残り 1 件 (F_v8_1) は **patch の場所が agent prompt だけで commands flow と未統合** だったため不発動。 v3.0.5 で main flow 側の logic を追加すれば 3 件全部 functional になる見込み。

v3 系 patch loop が **「agent prompt + main flow の両方を touch しないと complete にならない」** という設計教訓を獲得。
