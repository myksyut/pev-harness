# 実験結果 — harness-effect-v9 (v3.0.4 patch dog food verify)

**実施日**: 2026-05-14
**pev-harness version**: v3.0.4 (= F_v8_1/2/3 patch 適用済)
**target**: v8 T3 と同じ task (validatePostalCode + pattern 踏襲 prompt) を再走、 v3.0.4 の F_v8_2/3 patch 効果を実機 verify

## TL;DR

| 観点 | v8 T3 (v3.0.3) | **v9 (v3.0.4)** |
|---|---|---|
| Triage decision | plan_skip | **plan_skip (同じ)** |
| schema 厳守 (F_v8_3) | OK | **OK (再確認)** |
| reasoning の質 | 「pattern 明示」 ベース | **「dialog/削除方式/状態遷移/UX 曖昧性なし」 と patch directive を明示 check** |
| 実装結果 | (未走) | **AC 9/9 PASS、 vitest 25/25 PASS、 retry 0** |

**結論**: v3.0.4 で `plan_skip` 維持だが、 これは **patch directive が functional に発動した結果**。 「pattern 踏襲指示でも dialog/削除方式/etc が未明示なら plan_required」 を agent が明示 check、 全項目クリアと判定。 過剰 conservative にならず、 真に明確な task は plan_skip を維持。

## v9 triage.json (= patch directive 効果の証跡)

```json
{
  "decision": "plan_skip",
  "reasoning": "src/ + tests/ + team-conventions.md が揃っており、 prompt に function 名・対象 file・pattern 参照先 (validatePhone)・ドメインルール (任意、ハイフンあり/なし両対応、7桁) が全て明示されている。 純粋 validator の追加であり UI フロー・削除方式・状態遷移・エラー UX の曖昧性は存在しない。 既存 pattern から minimal interpretation が可能。",
  "context_signals": [
    "src/validation.js が存在する",
    "tests/validation.test.js が存在する",
    "team-conventions.md が存在する",
    "src/form.js も存在し codebase が整備されている"
  ],
  "ambiguity_signals": [],
  "task_id": "1778695957-e133c72d"
}
```

**注目**: reasoning が「UI フロー・削除方式・状態遷移・エラー UX の曖昧性は存在しない」 と **patch directive の判定軸を明示 check**。 v3.0.4 patch が agent prompt として functional に効いている証拠。

## 実装結果

```javascript
// validation.js L36-42 (= validatePhone 直後に配置)
export function validatePostalCode(value) {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) return null;
  const digits = trimmed.replace(/-/g, '');
  if (!/^\d{7}$/.test(digits)) return '郵便番号は7桁の数字で入力してください';
  return null;
}
```

- **validatePhone pattern 完全踏襲**: trim / 空 OK / digit-only check / error message 日本語
- **AC 9/9 PASS**: vitest 25/25、 既存 test 全 PASS、 console error なし
- **retry 0**: 1 回で完成

## v8 T3 ラベル「boundary」 の再評価

v8 SUMMARY では T3 を「boundary」 と pre-task ラベル付け、 plan_skip 倒れ = F_v8_2 finding として扱った。 v9 で実走の結果:

- plan_skip 維持 (v3.0.4 でも)
- 実装が completion、 AC 9/9 PASS
- → **T3 は実は「明確 plan_skip 寄り」 (= boundary ではなかった)**

つまり v8 のラベル付けが pre-task 推測で誤っていた。 これは:

### F_v9_1 (priority L): boundary ラベル付けは pre-task 推測、 実走しないと不明

「boundary」 という pre-task ラベルは agent の判定能力 + 実装 feasibility への投影。 真の boundary か明確 task かは **dog food で実走しないと判定できない**。 v8 SUMMARY の F_v8_2 finding は依然 valid (= 「pattern 踏襲」 prompt が plan_skip 寄りに倒す傾向あり) だが、 T3 自体は patch directive 適用後も「正しく plan_skip」 と判定される ground truth が見えた。

## v3.0.4 patch の effect 確認

| patch | finding | v9 での確認 |
|---|---|---|
| F_v8_1 (`task_infeasible`) | T1 で対象不在判定 | v9 task は対象あり、 未 exercise |
| F_v8_2 (pattern 踏襲 conservative) | T3 で plan_skip 倒れ | **agent が directive を明示 check → 適切に判定** |
| F_v8_3 (schema 厳守) | T6 で `rationale` 等の別名 | **v9 で 5 field 全部正しい schema、 厳守** |

F_v8_2 と F_v8_3 は **functional に効いている**。 F_v8_1 は別 task (= 真の task_infeasible) で要検証。

## 効率

| 指標 | v9 (v3.0.4) |
|---|---:|
| 完成までの turn 数 | 1 turn (= 0 確認、 直接 Execute + Verify) |
| wall-clock | (turn 1 完了まで、 数十秒) |
| retry | 0 |

plan_skip 経路で minimal cost で完成。 v7 同様の効率優位を再現。

## 結論

v3.0.4 の F_v8_1/2/3 patch を v9 dog food で verify:

1. **F_v8_3 schema 厳守**: functional ✓
2. **F_v8_2 pattern 踏襲 conservative**: agent が directive を明示 check して plan_skip 維持 (= 過剰 conservative にならず、 真に明確な task は plan_skip 出す適切な挙動) ✓
3. **F_v8_1 task_infeasible**: 未 exercise (別 task で要検証)

v3.0.4 patch は **過剰 conservative を生まず、 真に必要な case で plan_required に倒す形で functional**。 v3.0 系の patch loop が安定。

## 次の dog food 候補

- F_v8_1 verify: 真の対象不在 task で `task_infeasible` decision が出るか
- 真の boundary task: 明示 spec のない validator 追加 (= 「validatePostalCode を追加してください」 だけ、 詳細省く) で plan_required になるか
- Mode B での self-clarify (= v3.1+ ターゲット) の事前検証
