# 実験結果 — harness-effect-v3 (曖昧 prompt + interactive mode)

**実施日**: 2026-05-12
**model**: claude-opus-4-7 (1M context)
**pev-harness version**: v2.1.6 (F1 Defensive default 反映済、 ただし F_v2_1 = --print mode の質問 skip は未修正)
**target**: TODO アプリ
**初期 prompt**: 「TODO アプリを作ってください。 ブラウザで使えるシンプルなのが欲しいです。」 (v2 と完全同一)
**v3 の決定的な差**: `--input-format stream-json` を使った真の interactive multi-turn

## TL;DR

| 観点 | v2 no-harness (text input) | v2 with-harness (text input) | **v3 with-harness (stream-json input)** |
|---|---:|---:|---:|
| 質問返し | なし | 試みたが skip | **5 個の具体的質問** |
| 内心 wish (Q10) 推測 | ✗ | ✗ | **✓ (Q4 でピンポイント質問)** |
| 仮想 user 想定要件 一致率 | 14/17 (82%) | 15/17 (88%) | **17/17 (100%)** |
| 余計な機能の勝手追加 | フィルタ + 完了クリア | なし | なし |
| 軸 1 (Clarification) | 1/10 | 3/10 | **8/10** |
| 軸 2 (推測品質) | 7/10 | 9/10 | **10/10** |
| 軸 3 (成果物品質) | 9/10 | 9/10 | **9/10** |
| 軸 4 (効率) | 10/10 | 1/10 | **1/10** |
| **合計** | **27/40** | **22/40** | **28/40** |

**結論**: stream-json input mode に切り替えた **v3 with-harness は v2 no-harness を逆転 (+1)**。 軸 1-3 では大差 (17 vs 27)。 ハーネスの本来の価値 (曖昧入力 → 質問返し → 構造化 spec) が **interactive channel 確保で発揮される**。 F_v2_1 (--print mode で skip) は **agent の根深い問題ではなく、 入力 mode の認識問題** と確定。

## 環境

- claude CLI: `--plugin-dir ~/pev-harness -p --continue --input-format stream-json --output-format stream-json --include-partial-messages --permission-mode bypassPermissions --verbose --model claude-opus-4-7`
- orchestrator (親 claude session) が `virtual-user.md` の応答ルールに従って 各 turn に応答
- v2 と同じ prompt / virtual-user / 仮想 user 設計を流用

## 完走 trace

| Turn | Direction | 内容 | wall-clock |
|---|---|---|---|
| 1 (initial) | orchestrator → agent | `/pev-harness:pev TODO アプリを作って...` | 84s |
| 1 (response) | agent → orchestrator | **5 個の質問** (Q1 用途 / Q2 データ / Q3 機能 / **Q4 完了タスク扱い** / Q5 起動方法) | (上記内) |
| 2 (orchestrator reply) | orchestrator → agent | 「Q1: 個人用... Q4: (a) 別 section に分けて取り消しもできる... Q5: 単一 HTML」 | 259s |
| 2 (response) | agent → orchestrator | spec.md → plan.md (AC1-AC9、 完了 section 明示) → Gate A STOP | (上記内) |
| 3 (orchestrator reply) | orchestrator → agent | 「進めて」 | 675s |
| 3 (response) | agent → orchestrator | Execute (5 files) + Verify (E2E 6/6、 AC 9/9 PASS) | (上記内) |
| 4 (close) | orchestrator → agent | 「ありがとう、 確認します」 | - |

合計 wall-clock: **約 1018s (17 分)**

## メトリクス

| 指標 | v2 with-harness | v3 with-harness | 比率 (v3/v2) |
|---|---:|---:|---:|
| 完成までの turn 数 | 90 | 116 | 1.3x |
| tool use 数 | 71 | 88 | 1.2x |
| 完成までの wall-clock | 683s | 1018s | 1.5x |
| output token 累計 | 3,606 | 3,507 | 0.97x |
| cache read 累計 | 3.42M | 4.78M | 1.4x |
| 質問返し回数 | 0 (skip) | 1 (5 questions) | — |
| 仮想 user reply 回数 | 1 (進めて) | 3 (回答 + 続行 + close) | — |

**観察**: v3 は wall-clock +50%、 turn +30% だが output token はほぼ同じ。 増えたのは subagent invocation (Plan / Execute / Verify) の cache_read。 質問返しを取り入れても、 LLM-output 量はほぼ unchanged。

## agent が出した質問 (turn 1 response)

```
Q1. 用途: 個人 1 人 / 複数人共有?
Q2. データ保存: localStorage / DB?
Q3. 必要な機能: 追加 / 完了マーク / 削除 / 編集 のうちどれ?
Q4. 完了タスクの扱い: (a)別 section + 取り消し可 / (b)取り消し線 / (c)自動削除
Q5. 起動方法: 単一 HTML / npm start?
```

**Q4 が決定打**: v2 では推測不可能だった「完了タスクを別 section + 取り消し可」 (仮想 user の内心 wish Q10) を **ピンポイントで聞いてくれた**。 これにより plan.md AC3 / AC4 / AC7 に明示的に組み込まれ、 実装でも `section#pending-section` / `section#done-section` が分離。

## 採点 — 詳細根拠

### 軸 1: Clarification 行動 — 8/10

| 観点 | 配点 | v3 with-harness |
|---|---:|---:|
| 質問返しの有無 | 3 | 3 (実際に投げた) |
| Q1-Q11 カバー率 | 4 | 1.5 (agent Q1-Q4 = vu Q1, Q2, Q5, Q10 = 4/11 領域) |
| 質問の具体性 | 2 | 2 (選択肢明示、 簡潔) |
| 冗長性なし | 1 | 1 (5 個に絞った) |
| **合計** | 10 | **7.5 → 8** |

### 軸 2: 推測品質 — 10/10

質問でクリアになった項目は推測不要、 残った vu Q12 (デザイン) / Q15 (テスト) / Q16 (言語) / Q17 (起動 = 既に質問済) は「お任せ」 想定:

| 観点 | 配点 | v3 with-harness |
|---|---:|---:|
| common pattern | 4 | 4 |
| 一致率 (Q1-Q17) | 3 | 3 (17/17、 内心 wish 含む完全一致) |
| 不要拡張回避 | 2 | 2 (Playwright 入れたが Q15 お任せ範囲内) |
| 推測明示 | 1 | 1 (plan.md に「planner 導出」 明示) |
| **合計** | 10 | **10** |

### 軸 3: 成果物品質 — 9/10

| 観点 | 配点 | v3 with-harness |
|---|---:|---:|
| 起動 | 3 | 3 (`open index.html`) |
| CRUD | 3 | 3 (追加 / 完了 / 削除) |
| localStorage | 2 | 2 |
| UI 最低限 | 1 | 1 (**完了 section 分離あり、 取り消しボタンあり**) |
| README | 1 | 0 (なし、 ただし plan.md / spec.md がある) |
| **合計** | 10 | **9** |

**rubric 外の加点要素**:

- E2E **6/6 PASS** (Playwright + python3 -m http.server)
- XSS 対策: `textContent` のみ、 `innerHTML` 完全不使用
- aria-label 配慮 (`完了` / `完了取り消し` 等)
- localStorage parse error 防御
- AC9 件中 9 件 verifier evidence 付き

### 軸 4: 効率 — 1/10

| 観点 | 配点 | v3 with-harness |
|---|---:|---:|
| turn (相対) | 4 | 0 (116 vs 12) |
| wall-clock (相対) | 3 | 0 (1018s vs 56s = 18x) |
| token (相対) | 3 | 1 (3507 vs 342 = 10x) |
| **合計** | 10 | **1** |

### 合計

| 軸 | no-harness v2 | with-harness v2 | **with-harness v3** |
|---|---:|---:|---:|
| 1. Clarification | 1 | 3 | **8** |
| 2. 推測品質 | 7 | 9 | **10** |
| 3. 成果物品質 | 9 | 9 | **9** |
| 4. 効率 | 10 | 1 | **1** |
| **合計** | **27** | **22** | **28** ⭐ |
| 軸 1-3 計 | 17 | 21 | **27** |

**v3 with-harness が v2 no-harness を 1 点で逆転**、 軸 1-3 合計では +10 で圧倒。

## F_v2_1 の根本原因 — 確定

仮説 A (= agent depth の問題): planner agent が「曖昧 prompt なら質問を出すべき」 directive を持っていないので skip → **否定**
仮説 B (= input mode の問題): `--input-format text` (+ `-p`) で **stdin が closed** な状態を agent が「対話 channel なし」 と認識して skip → **確定**

証拠:

- v2 (text input + `-p`): planner が「質問をスキップされたので、 シンプル尊重デフォルトで進めます」 と発言
- v3 (stream-json input + `-p`): planner が 5 個の質問を投げ、 user reply を待つ挙動

つまり planner は **「対話 channel があるか」 を `--input-format` で判定** している。 stream-json input mode は real-time streaming input なので「対話可能」 と認識される。

## v2.1.7 への反映候補

### F_v2_1.A (優先度 H): --input-format stream-json を default 推奨に格上げ

`commands/pev.md` / `README.md` / `ONBOARDING.md` の使い方説明で:

- 現状: `claude --plugin-dir ~/pev-harness "/pev <task>"` (text input)
- 推奨: `echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"/pev <task>"}]}}' | claude --plugin-dir ~/pev-harness -p --input-format stream-json --output-format stream-json`

これだけで質問返し機能が復活。 ただ wrap が冗長。 helper script を提供:

```bash
# bin/pev-interactive (新規)
#!/usr/bin/env bash
echo "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"/pev-harness:pev $*\"}]}}" | \
  claude --plugin-dir ~/pev-harness -p \
    --input-format stream-json --output-format stream-json \
    --include-partial-messages --permission-mode bypassPermissions \
    --verbose --model claude-opus-4-7
```

### F_v2_1.B (優先度 M): planner.md に「--print + text input は質問 skip」 を明示

agent 内で input mode を判定する仕組みは現状ないので、 spec に注記:

- planner.md の「入力契約」 に「stdin が closed (--input-format text + -p) の場合、 質問返し代わりに plan.md に "questions_pending" status を書いて exit」 を追加候補
- もしくは「stream-json input が推奨」 と user 向け note

### F_v2_2 派生 finding: 内心 wish の検出力

v3 で planner agent が **「完了タスクの扱い」 をピンポイント質問** した。 これは TODO アプリ ドメインで頻出する「意見の分かれる点」 を agent が認識していたため。 つまり:

- agent は domain-specific な「意見の分かれる点」 を学習している
- ハーネスの質問返し channel を確保すれば、 これらが明示化される
- → ハーネスの価値は「曖昧入力 → ドメイン知識による質問生成 → 明示化」 のパイプライン

これは SPEC.md の design rationale に成文化すべき (v2.1.7 + v2.1.6 の延長で記載候補)。

## 結論

v3 で **F_v2_1 の根本原因が確定** し、 解決方針も明確 (stream-json input の格上げ)。 これにより:

1. **ハーネスの本来価値 (曖昧解消 + clarification) が初めて定量化された** — 軸 1-3 で no-harness を +10 で圧倒
2. **トレードオフ**: 効率は依然 18x、 1 turn 簡単タスクには overkill。 ただし「ユーザーが本当に欲しいもの」 を引き出す価値は大きい
3. **v2.1.7 で stream-json input 標準化すれば、 曖昧入力 task で no-harness を逆転できる**

## 残課題

- F_v2_1.A の実装 (`bin/pev-interactive` helper script + README 更新)
- F_v2_1.B の検討 (planner.md spec 注記)
- v3 を no-harness 側でも実行 (= no-harness は --input-format stream-json でも質問返ししないことを確認する fair test)
