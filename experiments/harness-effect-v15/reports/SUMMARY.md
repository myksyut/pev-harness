# 実験結果 — harness-effect-v15 (v3.3.0 Linear issue-first dog food、 設計バグ検出)

**実施日**: 2026-05-15
**pev-harness version**: v3.3.0
**target**: Gate L (Linear issue-first) の実機検証
**setup**: /tmp に sample-project cp + `git init` + `.linear-config.yml` (workspace=emuni-kyoto, team=TES) 配置

## TL;DR

**設計バグ F_v15_1 検出**: Gate L が **発動しなかった**。

| 観点 | 期待 | 実際 |
|---|---|---|
| Gate L 発動 | Linear issue 作成 + branch checkout | **不発動** |
| artifacts/linear/ | 生成 | **なし** |
| git branch | Linear 発行 branch | **main のまま** |
| 実 Linear への書き込み | TES team に issue 1 件 | **なし** (= 副作用なし、 不幸中の幸い) |

## 原因 (F_v15_1)

commands/pev.md の flow 順序:

```
Step 3   (Gate A)   — permissionMode=default → STOP, exit 0
Step 3.5 (Gate L)   — 到達せず ❌
Step 4   (Execute)  — 到達せず
```

v3.3.0 で Gate L を「Gate A の後、 Execute の前」 (= Step 3.5) に配置した。 だが **Gate A は default mode で `exit 0` で正常停止する** ため、 後続の Step 3.5 (Gate L) に制御が渡らない。

つまり v3.3.0 の Gate L は **`permissionMode=auto` もしくは `--force-auto` の時だけ発動** する状態。 default mode (= 最も一般的な設定) では完全に dead path。

## 走行 trace

- prompt: `/pev-harness:pev 申込フォームの電話番号 validator を、 国際電話番号形式にも対応するよう拡張してください。`
- Phase 0 (Triage): `plan_required` (= v3.0.4 F_v8_2 が正しく機能、 国際形式の仕様未明示で plan_required)
- Phase 1 (Plan): plan.md 出力、 確認質問 + default 解釈
- **Gate A: permissionMode=default → STOP (exit 0)**
- Gate L: **到達せず**
- Execute / Verify: 到達せず

## 正しい配置 (v3.3.1 patch)

Gate L を **Gate A の前** に移動: `Plan → Gate L → Gate A → Execute`

理由:

1. **issue body は plan.md ベースで作れる** — Gate L が Gate A の前でも plan.md は既に存在 (Plan が Step 2 で完了済)
2. **Gate A で停止しても issue + branch は準備済み** — user が plan.md をレビューして `/pev-execute` を打った時、 既に Linear branch 上で実装が走る
3. **plan_skip path との整合** — Triage が plan_skip した場合、 Plan も Gate A もないので、 Gate L は Triage の直後に置く必要がある

### v3.3.1 の flow (修正後)

```
Triage → (Plan?) → Gate L (Linear issue-first) → Gate A (Plan あり時のみ) → Execute → Verify
```

- plan_required path: Triage → Plan → **Gate L** → Gate A → Execute
- plan_skip path: Triage → **Gate L** → Execute (Gate A は元々 skip)

### 副作用の考慮

Gate L を Gate A の前にすると、 「default mode で user が plan.md を見て『やめる』 と判断しても Linear issue が残る」 という minor な副作用がある。 ただし:

- issue は「実装予定の task」 を表すので、 残っても意味的に問題ない (= user が手動で archive すればよい)
- それより「default mode で Gate L が完全に dead」 の方が遥かに重大なバグ
- → v3.3.1 で Gate L を前に移動、 副作用は許容

## 設計教訓 (F_v15_1)

**Gate / Step の順序設計時、 「前段の Gate が exit する」 ケースを必ず考慮する**。 v3.3.0 では「Gate A の後に Gate L」 と素直に並べたが、 Gate A は default mode で exit する Gate なので、 その後ろに置いた Gate は default mode で dead になる。

これは v3.0.5 F_v10_1 (= agent prompt + main flow 両 layer touch) / v3.2.1 F_v14_1 (= prompt directive 単体では不足) に続く **commands/pev.md の制御フロー設計の落とし穴** の 3 例目。 commands/pev.md は bash 制御フローなので、 `exit` / `case` / 条件分岐の順序が semantics を決める。

## 結論

v3.3.0 の Gate L は **配置ミスで default mode で dead path**。 実 Linear への書き込みは発生しなかった (= 不幸中の幸い、 副作用なし)。 v3.3.1 で Gate L を Gate A の前に移動して修正。

dog food が無ければ「CI green = 実装 OK」 と誤認したまま release していた。 **実機 dog food の価値** を再確認した事例。

## 次の patch (v3.3.1)

- commands/pev.md: Gate L (Step 3.5) を Gate A (Step 3) の前に移動 → Step 番号 re-order
- SPEC.md Phase Gates table の Gate L 位置を更新
- v3.3.1 release 後、 v16 で再 dog food (= 今度こそ Gate L が発動するか)
