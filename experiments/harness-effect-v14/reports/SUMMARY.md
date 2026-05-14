# 実験結果 — harness-effect-v14 (v3.2.1 MUST 化 verify、 失敗例)

**実施日**: 2026-05-14
**pev-harness version**: v3.2.1 (= MUST 化 + 3 条件厳格化 + check 記録必須)
**target**: v13b と同じ task (RFC 5322 email 強化 + --no-plan) を v3.2.1 で再走、 MUST 化が functional か

## TL;DR

**v3.2.1 MUST 化は不発動。 agent が依然として ad-hoc 進行**:

| 観点 | v13b (v3.2.0) | **v14 (v3.2.1)** |
|---|---|---|
| clarification.md 生成 | ✗ 未生成 | **✗ 未生成 (= 未改善)** |
| execute.log の check 記録 | なし | **なし (= MUST 化したが守られず)** |
| executor 挙動 | ad-hoc 進行 → AC PASS | **ad-hoc 進行 → AC PASS (= 未改善)** |
| 効果 | unknown | **MUST 化単体では効果なし** と確認 |

**新規 finding F_v14_1 (priority H)**: prompt directive hardening (= MUST tone + 厳格化 + 記録必須) **単体では agent 自走判断は防げない**。 v3.3+ で verifier 側 check (= 2 段階防御の第 2 段) が必須。

## v3.2.1 の挙動 (失敗詳細)

v3.2.1 で agents/executor.md に追加した hardening:

1. **trigger を「MUST stop」 hard-fail tone に変更** (= 命令調)
   - 期待: agent が「MUST stop」 という命令調を読んで停止
   - 実際: agent が「common sense で適切に処理できる」 と adaptive thinking で skip
2. **自走 OK な case を 3 条件すべて該当に厳格化** (= pattern 踏襲先 1:1 / 既存 helper 一意 / 1 file scope)
   - 期待: 3 条件 全部該当する必要があり、 RFC 5322 task は該当外で stop
   - 実際: agent が「validatePhone を pattern 踏襲先」 「validation.js 1 file scope」 と自己 OK 判定 (= 2 条件を緩く解釈)
3. **execute.log 冒頭に self-clarify check 記録を必須化**
   - 期待: agent が「self-clarify check」 を documented して justify
   - 実際: agent が **記録を書かず** に直接 `[Phase 2 (Execute): validateEmail を RFC 5322 準拠 ... に強化]` から始めた

つまり **3 つの hardening 措置すべてが LLM の adaptive thinking で skip された**。

## v3.0.5 F_v10_1 との対比

| dimension | v3.0.5 F_v10_1 (task_infeasible) | v3.2.1 F_v14_1 (Mode B Self-Clarify) |
|---|---|---|
| 構造問題 | agent prompt directive を main session が skip | agent prompt directive を agent 自身が skip |
| 解決方法 | main session 側で agent invoke を強制 (= commands/pev.md に triage 受領 logic) | verifier 側で execute.log の check 記録の有無を強制? (v3.3+) |
| 解決の容易さ | 比較的容易 (= main flow に bash logic 追加) | 困難 (= 別 agent (verifier) で別 turn の output を判定) |

## v14 実装の質的評価

agent が ad-hoc 進行した結果の実装は **AC 25/25 PASS** で完成:

```javascript
// src/validation.js L16-32 (= v14 with v3.2.1)
const EMAIL_LOCAL_PART_RE = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+$/;
const EMAIL_DOMAIN_LABEL_RE = /^[a-zA-Z]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const EMAIL_TLD_RE = /^[a-zA-Z]{2,}$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;

export function validateEmail(value) {
  // ... (RFC 5322 atext + RFC 1035 LDH label + TLD ≥ 2 文字)
  // 長さ制約: 全体 254 文字 (RFC 5321) / local-part 64 文字
  // dot 制約: 先頭/末尾 dot 禁止、 連続 dot 禁止
}
```

これは「common sense で適切な選択」 + 既存 test backward compat (`user.name+tag@sub.example.co.jp` 通過維持)。 **agent の自走品質は高い**。

ただし harness 設計者視点では:

- user (= PM) は「RFC 5322 のどのサブセット?」 を質問されるべき
- agent が独断で **OWASP 推奨 + 一部独自** な仕様を選択
- PR レビュー時に「あ、 そのサブセットでよかったの?」 と再質問 risk

ハーネスの主要 value (= user の頭の中の spec を引き出す) は未達成。

## v3.3+ の方向性

prompt directive hardening では限界。 構造的解決として:

### 候補 A (priority H): verifier 側で execute.log check (= 2 段階防御)

verifier agent に「Mode B 実行時、 execute.log 冒頭に self-clarify check 記録があるか」 を判定 step として追加:

- check 記録あり → 進行 OK
- check 記録なし + Mode B 経路 + 既存 codebase に「明らかに pattern 1:1 対応」 がない → **retry 強制** (= planner 経由で確認質問)

これは v3.3.0 として実装候補。

### 候補 B (priority M): Mode B 自体を限定的に発動させる

v3.0.4 F_v8_2 で「pattern 踏襲指示でも boundary は plan_required」 と Triage を conservative 化した結果、 Mode B はかなり rare path になった。 これ自体は適切設計。

ただ `--no-plan` で意図的に Mode B 強制した時、 self-clarify が unreliable。 → Triage 結果なしで Mode B 起動を **禁止** する選択肢もある (= `--no-plan` flag を deprecate)。

### 候補 C (priority L): self-clarify hook で物理的に強制

PostToolUse hook で「executor の Mode B 起動完了時に execute.log の check 記録を grep、 ない場合は警告 / retry」 を bash で強制。 これは prompt directive を超えた 物理層防御。

## 結論

v3.2.1 で agents/executor.md に MUST tone + 3 条件厳格化 + check 記録必須化を入れたが、 **すべて LLM adaptive thinking で skip された**。 prompt directive 単体の限界が dog food で明確化。

v3.3+ で verifier 側 check (= 候補 A) を追加することで 2 段階防御を構築するのが最も合理的。

**v3.2.1 patch 自体は documentation として価値あり** (= 「ここで stop すべき」 と spec 化された)、 ただし enforcement が弱い。 v3.3 で構造補完が必要。

## 派生 finding

### F_v14_2 (priority M): LLM の自走能力は「高品質だが spec ずれ」 を生む

v14 実装は AC 25/25 PASS、 既存 test 互換、 OWASP 推奨に近い実装。 **agent の common sense は十分高い**。 だが「user の意図」 と「agent の自己採用」 が一致するとは限らない。 これはハーネス設計の根本的 trade-off:

- agent を信頼 → 高品質だが spec drift risk
- agent を制限 → spec 準拠だが overhead 大

v3 系で確立した「Triage (= 入口の振り分け) + 質問判定強化 (= 不明確な領域は user 確認)」 path は適切だが、 Mode B の self-clarify はまだ enforcement が弱い。
