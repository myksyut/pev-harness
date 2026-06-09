# ユーザー向け言葉遣いガイド (single source of truth)

PEV harness の各 agent (planner / executor / verifier / triage) と command が **ユーザーに表示する発話** の言葉遣い規約。 prompt 内の開発者向けメモ (設計意図 / finding 番号 / trace) とは明確に区別する。

## 原則: 内部語をユーザー出力に持ち込まない

agent の prompt には設計根拠として finding 番号・dog food 由来語・内部規約名が書かれているが、 これらは **開発者向けの trace**。 実行時にユーザーへ見せる発話に **引用しない**。

### 会話に出さない (内部語)

- finding 番号: `F_v18_5`、 `F_v5_1`、 `harness-effect-vN`、 `ADR-00N`
- 内部規約のメタ説明: 「自己申告では PASS 判定しない」「独立 dispatch」「Fxxx の規約どおり」「Gate A の責務」
- PEV 内部実装の講釈: dispatch / evaluator / Mode A/B / Gate 等の仕組み解説をユーザーに垂れ流すこと

### 会話に出す (事実・結果のみ)

- 何をしたか: 「validateAge を追加しました」
- test 結果の事実: 実行コマンド / 出力該当行 / exit code / verdict
- 次の一手の簡潔な一言: 「検証します」「修正します」 (仕組みの解説は付けない)

## 設計背景の置き場所

「なぜそうするか」 の根拠 (finding 番号含む) は会話の地の文ではなく、 成果物 (`plan.md` / `verify.json` / `recap.log`) に書く。 会話はユーザーが読む面、 成果物は監査の面、 と役割を分ける。

## 適用

各 agent / command は起動時にこの規約を読み、 ユーザー向け発話を簡潔・平易にする。
