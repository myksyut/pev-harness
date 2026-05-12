# v3.0 dog food (= harness-effect-v4 を v3.0 で再走)

**Date**: 2026-05-12
**Target**: 既存 sample-project に「ご質問・ご要望」 textarea 追加 (= v4 と同じ task)
**Compared against**: v4 with-harness (= v2.1.6 ハーネス)

## 結果

| 観点 | v4 with-harness (v2.1.6) | **v3.0 with-harness** |
|---|---:|---:|
| Triage agent | なし | ✓ `plan_required` 判定 (artifacts/triage.json) |
| Plan の 「## 確認質問」 | なし | **✓ 3 件** (label / 配置 / counter) |
| 文字数 counter 実装 | ✗ Non-goal | **✓ 完全実装** (リアルタイム + warning/error 色) |
| field name | `message` | **`inquiry`** (= 仮想 user 内心 spec Q10 一致) |
| 配置 | spec 通り | **「利用規約の上」 (= Q4 一致)** |
| Verify verdict | PASS | **PASS** (retry 0) |
| AC 件数 | 10 (counter 関連 4 件 ✗) | **29 件全 PASS** |
| unit test | 28/28 | **33/33** |
| E2E test | 7/7 | **7/7** |
| console error | claim 0 | **0** (verifier 実機検証) |

## 効率比較

| 指標 | v4 with-harness | **v3.0 with-harness** | 比率 |
|---|---:|---:|---:|
| turn 数 | 100 | 127 | +27% |
| tool use | 71 | 105 | +48% |
| output token | 1,938 | 3,907 | +101% |
| wall-clock | 646s | 1,007s | +56% |

v3.0 は v4 より重い (+ 56% time)。 ただし Triage + 確認質問 のための追加コスト。 品質は劇的に向上。

## v4 no-harness との比較

| 観点 | v4 no-harness | v4 with-harness (v2.1.6) | **v3.0 with-harness** |
|---|---:|---:|---:|
| 軸 1 Clarification | 1 | 3 | **9** |
| 軸 2 spec 準拠 (AC) | 10/10 | 6.5/10 | **10/10** |
| 軸 3 convention | 9 | 9 | 9 |
| 軸 4 test 維持 | 9 | 7 | **9** |
| 軸 5 効率 | 10 | 1 | 1 |
| **合計 (50)** | **39** | **26.5** | **38** |
| **軸 1-4 計** | **29** | **25.5** | **37** |

**v3.0 with-harness が軸 1-4 (品質) で no-harness を +8 で逆転** (v4 では -3.5 で負けていた)。 軸 5 (効率) は 24.6x の差、 ここは依然 trade-off。

## v3.0 設計の検証

| v3.0 設計要素 | 動作確認 |
|---|---|
| **Triage agent** | ✓ artifacts/triage.json に decision + reasoning + signals |
| **plan_required で Plan invoke** | ✓ 既存 codebase + UI 拡張要素未明示 → plan_required と正しく判定 |
| **Plan の「## 確認質問」 必須化** | ✓ 3 件出力、 user 回答後に plan 確定 |
| **F1 (Defensive default) scope 限定** | ✓ counter UI を「Non-goal」 倒れせず、 質問対象に |
| **Plan-less mode の executor (Mode B)** | (今回は plan_required になったので 未検証、 別 task で要確認) |

## findings (v3.1+ 候補)

- **F_v3_0_1 (P L)**: plan.md 内の counter spec で表記揺れ (`450` vs `451`)。 executor が user 回答を最優先で解釈してくれたので結果 OK だが、 plan agent の表記精度に余地
- **F_v3_0_2 (P L)**: Triage の ambiguity_signals (5 件) は良質。 ただし planner の確認質問 (3 件) よりも signal 数の方が多いのは興味深い。 Triage と planner の質問判定の重複領域があるかもしれない
- **F_v3_0_3 (要 dog food)**: plan-less mode (Mode B、 Triage が plan_skip 判定したケース) の実機検証が未完。 単純 task (typo 修正 / docs 更新) で確認必要

## 結論

v3.0 の 4 本柱 (Triage + Plan on-demand + 質問判定強化 + F1 refine) は **設計通り動作、 v4 で発生した F_v4_1 (counter UI 漏れ) を完全解消**。 ハーネスの本来 value 「user の頭の中の spec を引き出す」 が実務的 task でも実現された。
