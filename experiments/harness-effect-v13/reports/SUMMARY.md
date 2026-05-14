# 実験結果 — harness-effect-v13 (v3.2.0 Mode B Self-Clarify dog food)

**実施日**: 2026-05-14
**pev-harness version**: v3.2.0
**target**: Mode B Self-Clarify Protocol が ambiguous task で発動するか検証

## TL;DR

| run | task | 結果 |
|---|---|---|
| v13 (default) | validateEmail 強化、 「pattern 踏襲」 prompt | Triage が plan_required (v3.0.4 F_v8_2 directive 直撃) → Planner で「## 確認質問」 5 件 (= 期待通りだが Mode B 経路ではない) |
| v13b (--no-plan) | validateEmail 強化 (RFC 5322) | **executor が Self-Clarify せず推測実装 → AC 6/6 PASS で完成** (= F_v13_2 検出) |

**新規 finding F_v13_2 (priority H)**: Mode B Self-Clarify Protocol を agents/executor.md に prompt directive で書いたが、 executor agent が **directive を遵守せず adaptive thinking で推測実装**。 v3.0.5 F_v10_1 と類似の構造問題: **agent prompt directive は agent の自走判断で上書きされる**。

## v13 (default flag)

Triage が plan_required に倒れ、 Mode B が起動しなかった。 Triage reasoning:

> 「RFC 5322 サブセットレベルが未指定 (完全 RFC 5322 は 6000+ 字 regex で非現実的、 どこまでを「厳密」 とするか不明)、 拒否すべき pattern が未明示、 既存 test の backward compatibility 要件が未確認、 ...」

ambiguity_signals 4 件で plan_required 判定。 これは v3.0.4 F_v8_2 conservative directive (= pattern 踏襲指示でも dialog/削除方式/etc 未明示なら plan_required) が正しく functional。

→ Planner が起動して plan.md に Q1-Q5 確認質問を出力、 Gate A 停止。 **Mode B Self-Clarify Protocol は exercise されなかった**。

新規 finding F_v13_1 (priority M): Mode B Self-Clarify Protocol を発動させるには **「Triage で plan_skip + 実装中に grey zone」** という条件が必要。 v3.0.4 F_v8_2 (Triage の conservative) と組み合わせると Mode B 自体が rare path になる。 v3.2.0 設計時にこの相互作用を見落としていた。

## v13b (--no-plan flag)

`--no-plan` flag で Triage skip + Plan skip 強制、 直接 executor Mode B 起動。

**期待**: executor が ambiguity (RFC 5322 のサブセット) に当たって clarification.md を書いて exit

**実際**:

- `artifacts/clarification.md` **未生成**
- executor は ad-hoc な強化判断で実装 (= local-part / domain 分割、 連続ドット拒否、 数字 TLD 拒否、 etc.)
- 「`'RFC 5322 強化された境界値'` it block を追加して 7 エッジケース網羅」 と自己採用
- verifier 判定: **AC 6/6 PASS、 npm test 26/26 PASS、 retry 0**

つまり executor は task が ambiguous であることを認識しながらも、 **adaptive thinking で「common sense で適切な選択」 を行った**。 これは LLM の本性に近い: prompt directive の「5 trigger に当たれば必ず停止」 を、 agent が「いや、 自分の判断で適切に処理できる」 と上書きする。

### F_v13_2 詳細

v3.0.5 F_v10_1 と同じ構造問題:

| layer | 問題 | v3.0.5 で解決した path | v13b で再発 |
|---|---|---|---|
| agent prompt directive | 「不明確なら停止 + report」 と書く | triage.md で task_infeasible decision 規定 | executor.md で 5 trigger + format 規定 |
| agent 自走判断 | agent が「自分で適切に処理できる」 と判断 | main session が自走で triage skip → 自走停止 | executor が自走で「ad-hoc 強化で OK」 と判断 |
| 必要な解決 | main flow logic で agent invoke を強制 | ✓ v3.0.5 で commands/pev.md に統合 | **未解決 — v3.2.1 hotfix 候補** |

### F_v13_2 解決案 (v3.2.1 候補)

agent prompt directive 単体では信頼性が低い。 以下のいずれかで構造的補完:

1. **executor 起動前の pre-execute Self-Clarify check** を main flow に追加: triage.json の context_signals / ambiguity_signals を元に「Mode B 実装可能か」 を main が pre-judge
2. **verifier 側で「executor が Self-Clarify 漏れ」 を検出**: verify 時に「task に ambiguity が残ったまま実装したか」 を判定、 検出時 retry
3. **executor.md の trigger を `if any trigger matches → MUST stop` と strict 化**: prompt directive を hard-fail tone に変える (= 既存の説明調から命令調へ)

**推奨**: (3) を最小 patch、 加えて (2) を v3.3+ で検討。

## v3.2.0 と v3.0.x 系の比較

| layer | 修正されている? | comment |
|---|---|---|
| triage agent | ✓ F_v8_2 conservative + F_v8_3 schema + F_v8_1 task_infeasible | v3.0.4 patch loop で stable |
| commands/pev.md (main flow) | ✓ task_infeasible 受領 (F_v10_1 / v3.0.5) | stable |
| planner agent | ✓ F_v5_1 pattern 踏襲 + F_v6_1 DOM 分離 | v3.0.1 / v3.0.3 patch loop で stable |
| **executor agent (Mode B Self-Clarify)** | ✗ F_v13_2 で agent 自走判断 上書き | v3.2.1 hotfix 必要 |

## 結論

v13 で v3.0.4 F_v8_2 が **正しく機能** (= boundary task で plan_required)、 v13b で v3.2.0 Mode B Self-Clarify が **不発動** (= F_v13_2)。

v3.2.0 patch は agent prompt directive を入れただけでは不足。 v3.0.5 で確立した「agent prompt + main flow 両 layer touch」 設計教訓を **v3.2.1 で executor 側にも適用**:

- executor.md の Self-Clarify trigger を hard-fail tone (= MUST stop) に refine
- verifier 側で Mode B 漏れ検出 path を追加 (v3.3+)

v13b 実装自体は functional (AC 6/6 PASS) で「common sense は十分高い」 ことも実証された。 ただし「ambiguity を user 確認に流す」 設計意図は未達成。 v3.2.1 patch で構造補完。
