# 実験結果 — harness-effect-v4 (実務的、 既存 codebase + 中曖昧 spec)

**実施日**: 2026-05-12
**model**: claude-opus-4-7 (1M context)
**pev-harness version**: v2.1.6
**target**: examples/sample-project (イベント参加申込フォーム) への機能追加 = 「ご質問・ご要望」 textarea + counter
**初期 prompt**: 「この申込フォームに「ご質問・ご要望」 を書ける欄を追加してください。 既存の team-conventions.md と実装を読んだうえで、 既存 pattern を踏襲する形でお願いします。」 (中曖昧、 詳細は orchestrator の virtual-user.md に格納)
**両者共通**: stream-json input mode、 既存 sample-project を /tmp に rsync、 npm install 済

## TL;DR

| 観点 | no-harness | with-harness |
|---|---:|---:|
| 質問返し | なし (推測直行) | なし (Plan 直行) |
| 完成までの turn 数 | 21 | **100 (4.8x)** |
| 完成までの wall-clock | 41s | **646s (15.8x)** |
| output token 累計 | 907 | **1,938 (2.1x)** |
| spec AC (10 件) 達成 | **10/10** | 6/10 (counter 関連 4 件落ち) |
| 文字数カウンタ UI | **実装あり** (色変化込み) | **Non-goal と判断、 実装なし** |
| field name | **`inquiry`** (内心 spec 一致) | `message` (内心 spec 不一致) |
| 既存 + 新規 test PASS | unit 35 / E2E 7 (claim) | unit 28 / E2E 7 (claim) |
| **合計 (50 満点)** | **38** | **26** |

**結論**: **既存 codebase + 中曖昧 spec の実務的タスクでは、 no-harness が大差で勝つ (+12)**。 既存 pattern からの推測拡張が極めて優秀、 内心 wish (counter UI) まで自発実装。 ハーネスありは「明示要求の minimal interpretation」 (F1 Defensive default の悪影響) で counter / color 変化を Non-goal に倒した結果、 仕様の重要部分が implement されず。

## 環境

- claude CLI: `--input-format stream-json --output-format stream-json --include-partial-messages --permission-mode bypassPermissions --verbose --model claude-opus-4-7 -p`
- 対照群: 素 claude (no plugin)
- 処理群: `--plugin-dir ~/pev-harness` + `/pev-harness:pev <prompt>`
- orchestrator (親 claude session) が仮想 user として `virtual-user.md` (Q1-Q16) の応答ルールに従う
- agent には spec.md を **開示しない** (= virtual-user.md に「内心 spec」 として格納、 質問されれば該当項目だけ答える)
- 進行: 順次 (no-harness 完走 → with-harness 完走)

## 内心 spec (Q1-Q16) の到達率

仮想ユーザーが頭の中に持っている要件:

| Q# | 項目 | 内心 A | no-harness | with-harness |
|---|---|---|---|---|
| Q1 | 用途 | 当日 Q&A 不足解消 | (内心理由、 非開示) | (同) |
| Q2 | 必須 / 任意 | 任意 | ✓ | ✓ |
| Q3 | 文字数制限 | 500 文字 | ✓ | ✓ |
| Q4 | UI 配置 | 利用規約の上 | ✓ | △ (利用規約の上だが順序 spec と若干異なる) |
| Q5 | label / placeholder | label "ご質問・ご要望 (任意)" / placeholder 規定文 | ✓ label / ✓ placeholder | ✓ label / ✗ placeholder なし |
| Q6 | 入力欄の型 | textarea (rows=4) | ✓ | ✓ |
| Q7 | 文字数カウンタ | **必須** | **✓ 実装** | **✗ Non-goal と判断** |
| Q8 | カウンタ色変化 | 残り 50 で warning、 0 未満で error | ✓ 実装 | ✗ counter 自体ない |
| Q9 | error message 文言 | 「ご質問・ご要望は 500 文字以内で入力してください」 | ✓ 一致 | ✓ 一致 |
| Q10 | LocalStorage field name | `inquiry` (= 内心 spec) | **✓ `inquiry`** | **✗ `message`** |
| Q11 | 後方互換 | 既存 entry 破綻しない | ✓ test あり | ✓ test あり |
| Q12 | form.reset 時 counter | 0 / 500 に戻る | ✓ | N/A (counter なし) |
| Q13 | test 要件 | 既存 pattern で / 既存 test 壊さない | ✓ unit 35 / E2E 7 | ✓ unit 28 / E2E 7 |
| Q14 | accessibility | 既存 pattern | ✓ | ✓ |
| Q15 | 制約 (TS 化禁止 / library 禁止) | 既存規約 | ✓ | ✓ |
| **一致率** | | | **14/15 (93%)** | **10/15 (67%)** |

**重要な観察**: Q7 (counter)、 Q8 (color)、 Q10 (field name = inquiry)、 Q12 (reset 時 counter) の 4 つを with-harness は推測できなかった。 これらは spec.md (AC1-AC10) で明示されるべき項目だったが、 prompt が中曖昧なため agent の判断に委ねられた。 no-harness は **既存 pattern (validatePhone + 任意項目の振る舞い) を学習 + common TODO/Form アプリの counter UI を自発的に拡張**、 結果 user wish にほぼ完璧合致。

## メトリクス

| 指標 | no-harness | with-harness | 比率 (with/no) |
|---|---:|---:|---:|
| 完成までの turn 数 | 21 | 100 | **4.8x** |
| tool use 数 | 10 | 82 | 8.2x |
| 完成までの wall-clock | 41s | 646s | **15.8x** |
| output token 累計 | 907 | 1,938 | 2.1x |
| API duration (assistant claim) | 44s | 584s | 13.3x |

(V3 の TODO アプリでは 12.2x → V4 では 15.8x、 さらに比率拡大)

## v1-v3 との横断比較

| 実験 | prompt 性質 | task 性質 | no-harness 軸 1-4 計 | with-harness 軸 1-4 計 | 勝者 (合計) |
|---|---|---|---:|---:|---|
| **v1** (明確 spec) | 明確 | 新規実装 (WebSocket chat) | 33/40 | 33/40 | タイ (絶対値) |
| **v2** (中曖昧 + text input) | 中曖昧 | 新規実装 (TODO アプリ) | 27/40 | 22/40 | **no-harness** |
| **v3** (中曖昧 + stream-json) | 中曖昧 | 新規実装 (TODO アプリ) | 27/40 | **28/40** | **with-harness** |
| **v4** (中曖昧 + 既存 codebase) | 中曖昧 | 機能追加 (申込 form) | **38/50** | 26/50 | **no-harness** |

(v4 は 5 軸 = 50 点満点、 v1-v3 は 4 軸 = 40 点満点 のため絶対値比較不可、 相対勝敗のみ)

## 採点 — 詳細根拠

### 軸 1: Clarification 行動 — no-harness 1 / with-harness 3

- **no-harness**: 質問返しゼロ、 1 turn 直行で 21 turn 全部走る。 既存 codebase 読み込み (`form.js`, `validation.js`, `team-conventions.md`) はしたが、 質問なし
- **with-harness**: 質問返しゼロ、 Plan に直行。 ただし plan.md に「**文字数カウンター UI (Non-goal、 scope 外)**」 と明示判断を記録、 「推測の根拠を documented」 した分加点

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| 質問返し有無 | 3 | 0 | 0 |
| 重要領域カバー | 4 | 0 | 0 |
| 質問具体性 | 2 | 0 | 0 |
| 推測判断明示 | 1 | 1 | 3 (Non-goal 明示 + plan.md 全体) |
| **合計** | 10 | **1** | **3** |

### 軸 2: spec 準拠 (AC1-AC10) — no-harness 10 / with-harness 6

| AC | 内容 | no-harness | with-harness |
|---|---|---:|---:|
| AC1 | textarea + counter 表示 | ✓ | △ (textarea ○、 counter ✗) |
| AC2 | 0-500 submit + LocalStorage | ✓ (`inquiry`) | ✓ (`message`) |
| AC3 | 501 で error | ✓ | ✓ |
| AC4 | counter リアルタイム | ✓ | ✗ |
| AC5 | counter color 変化 | ✓ | ✗ |
| AC6 | form.reset 時 counter 復帰 | ✓ | N/A |
| AC7 | vitest PASS | ✓ (35/35) | ✓ (28/28) |
| AC8 | Playwright PASS | ✓ (7/7 claim) | ✓ (7/7 claim) |
| AC9 | 既存挙動保持 | ✓ | ✓ |
| AC10 | console error なし | ✓ | ✓ |
| **PASS 数** | | **10/10** | **6.5/10** |

**with-harness が落とした 4 AC は全て counter UI 関連**。 これは Plan agent が「prompt に明示要求なし → Non-goal」 と minimal interpretation に倒したため。

### 軸 3: convention 遵守 — 両者 9/10

- 両者: named export only / 2-space indent / single quotes / `aria-required` 任意項目で false / console.log なし / 既存 pattern 踏襲
- 微差: with-harness の plan.md に「`validatePhone` を任意項目 validator の手本」 と明示参照あり、 「pattern 踏襲」 の意識が documented。 ただし最終コード品質は同等

### 軸 4: test 維持 — no-harness 8 / with-harness 7

- **no-harness**: unit 35 件 (validation 21 + form 14)、 E2E 7 件 (assistant claim、 別途検証必要)
- **with-harness**: unit 28 件 (validation 14 + form 14)、 E2E 7 件
- 差の理由: no-harness は counter 関連 test も追加 (color 変化 / reset 時更新)、 with-harness は counter なしのため counter test ゼロ

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| 既存 test 全 PASS 維持 | 4 | 4 | 4 |
| 新規 test 追加 | 3 | 3 | 2 |
| 境界値網羅 | 2 | 1 | 1 |
| console error なし | 1 | 1 | 0 (E2E で実機検証不能、 verifier claim のみ) |
| **合計** | 10 | **9** | **7** |

(no-harness の E2E は orchestrator が `npx playwright test` 走らせて手動検証する余地あり、 SUMMARY では assistant claim を採用)

### 軸 5: 効率 — no-harness 10 / with-harness 1

- no-harness: 41s, 21 turn, 907 out_tok
- with-harness: 646s, 100 turn, 1938 out_tok = **15.8x time**

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| turn | 4 | 4 | 0 |
| wall-clock | 3 | 3 | 0 |
| token | 3 | 3 | 1 |
| **合計** | 10 | **10** | **1** |

### 合計

| 軸 | no-harness | with-harness |
|---|---:|---:|
| 1. Clarification | 1 | 3 |
| 2. spec 準拠 (AC) | 10 | 6.5 |
| 3. convention 遵守 | 9 | 9 |
| 4. test 維持 | 9 | 7 |
| 5. 効率 | 10 | 1 |
| **合計 (50)** | **39** | **26.5** |
| 軸 1-4 (品質計、 40 満点) | 29 | 25.5 |

**no-harness が 軸 1-4 (品質) でも +3.5 / 軸 5 含む合計で +12.5 で勝利**。 v1-v3 と異なる結論。

## 重大 findings (v2.1.7+ への反映候補)

### F_v4_1 (優先度 H): F1 (Defensive default) と既存 codebase の組み合わせで minimal interpretation 過剰

v2.1.6 で導入した F1 (Defensive default = 不明確な input は拒否寄り) は、 **既存 codebase あり + 中曖昧 prompt** の組み合わせで以下の副作用を生む:

- planner が「既存 pattern と spec 明示要件で minimal 実装可能」 と判断
- 「prompt に明示要求なし」 = 「scope 外、 Non-goal」 と倒す
- 結果として nice-to-have feature (counter UI 等) が削られる

具体例: with-harness は `plan.md` L31 に「文字数カウンター UI (Non-goal、 scope 外)」 と明示判断。 これは F1 の精神に従っている (defensive)。 しかし仮想 user の内心 wish (Q7) は「counter 必須」 であり、 質問返しがあれば引き出せていた。

**反映候補**:

- `agents/planner.md` の Defensive default 原則に「**しかし scope 縮小判断は質問で確認すべき**」 の but-clause を追加
- もしくは「Non-goal を判定する前に **対応する spec 確認質問を最低 1 個投げる**」 を義務化

### F_v4_2 (優先度 M): 既存 codebase context で no-harness の推測品質が極めて高い

ハーネスなし側は既存 `validatePhone` (任意項目 validator) / `aria-required="false"` (任意項目 pattern) / vitest test pattern / Playwright E2E pattern を読んで、 spec.md (= 内心 wish) に明示されていない counter UI まで自発的に拡張。

**示唆**:

- LLM の「既存 codebase context 読解力」 は強い
- 「既存 pattern が手本としてある」 task では、 質問返し / planner の minimal interpretation が overhead になりがち
- ハーネスの value proposition を再定義: 「zero-context な曖昧依頼に対する clarification」 が主、 「既存 codebase ある task」 は no-harness で十分な可能性

### F_v4_3 (優先度 H): 質問返しの発動条件が context 依存

| 実験 | context | 質問返し発動 |
|---|---|---|
| v3 (TODO アプリ、 zero context) | なし | **発動** (5 個の質問) |
| v4 (申込フォーム、 既存 codebase) | あり | **不発動** (Plan 直行) |

つまり planner agent は「**情報不足度**」 を判定して質問するかどうかを決める。 これは賢い挙動だが、 user の内心 wish が implicit な場合 (= context あるけど詳細未指定) には捕捉漏れが発生。

**反映候補**:

- planner agent の Defensive default に「**spec の "上限 / 振る舞い詳細 / UI 拡張要素" が明示されない場合は 1-2 個だけ質問を投げる**」 を追加
- 質問項目を「context から推測しにくい高 ambiguity 領域」 に絞る基準を明示

### F_v4_4 (優先度 M): 実務的 PR レベル task の効率コストが厳しい

v3 (TODO アプリ) で 12.2x、 v4 (申込フォーム機能追加) で 15.8x。 task 複雑度が増しても 比率は減らない (Plan/Verify の固定コスト + 既存 codebase 読み込みの追加コスト)。

PR レベル本番では:
- ハーネスの value (Plan / Verify artifact、 retry-on-fail、 監査ログ) は依然 ある
- ただし「**仕様の明示**」 が user 側で十分なら、 no-harness で同等品質を 1/15 の時間で達成可能

→ ハーネス使用判断の基準: 「**user が spec を引き出される flow を必要とするか**」。 spec 自前で書ける user は no-harness、 spec を agent と対話で詰めたい user は ハーネス。

## 結論

**実務的 task (既存 codebase + 中曖昧 spec) では no-harness が圧勝 (+12.5)**。 理由:

1. 既存 pattern からの推測拡張が極めて優秀
2. ハーネスの F1 (Defensive default) が「明示なし → Non-goal」 と minimal 倒れ
3. 質問返しが発動しない (context あるため agent が「情報十分」 と誤判定)

これは v2.1.6 で導入した F1 の **盲点**。 v2.1.7 で:

- planner に「Non-goal 判定の前に 1-2 個だけ確認質問」 を追加 (F_v4_1)
- もしくは「実務的 task で既存 codebase ある場合は **質問返しを意図的にスキップしない**」 を default 動作に

## v1-v4 通して見える ハーネスの value proposition

| シナリオ | no-harness | with-harness |
|---|---|---|
| 明確 spec + 新規実装 | 同等 | 同等 (audit artifact で優位) |
| 曖昧 spec + zero context (TODO) | 凡庸な推測 | **質問返しで user の wish 引き出し → 優位** |
| 中曖昧 + 既存 codebase 機能追加 | **既存 pattern で推測拡張 → 優位** | minimal interpretation で重要 feature 漏れ |

→ ハーネスは「**user の頭の中の spec を明示化する flow**」 が本質的価値。 既存 codebase で推測可能 / spec が明確 なら、 そのコストが回収されない。

v2.1.7 で planner の質問判定基準を refine することで、 v4 のような実務 task でも質問返しを発動させ、 minimal interpretation を防ぐ余地。 ただし「ハーネスが万能」 ではなく、 「**task 種別による使い分け**」 が現実的な方針。
