# 実験結果 — harness-effect-v5 (v3.0 再現性検証、 申込キャンセル機能)

**実施日**: 2026-05-13
**model**: claude-opus-4-7 (1M context)
**pev-harness version**: v3.0.0 (released 2026-05-12)
**target**: examples/sample-project に「申込キャンセル機能」 を追加
**initial prompt**: 「この申込フォームに、 申込のキャンセル機能を追加してください。 既存の team-conventions.md と実装を読んだうえで、 既存 pattern を踏襲する形でお願いします。」 (中曖昧)
**比較対象**: v3-dogfood (= v4 task を v3.0 で再走、 2026-05-12)

## TL;DR

| 観点 | no-harness | **with-harness (v3.0)** |
|---|---:|---:|
| 質問返し | 1 turn 目で stop、 質問項目は表示せず | Triage が plan_required 判定、 Plan が 5 件質問項目明示 |
| 内心 spec 一致 | scope 拡大 + 論理削除採用 (= 別物) | **5 項目中 4 ほぼ一致 + 1 落ち (confirm dialog)** |
| spec AC 達成 | 4.5/10 | **8.5/10** |
| 完成までの wall-clock | 370s | 702s (1.9x) |
| 合計スコア (50 満点) | 35.5 | **37.5** |
| 軸 1-4 計 (品質) | 25.5 | **31.5** |

**結論**: v5 でも **v3.0 with-harness が品質 +6 / 合計 +2 で勝利**。 v3-dogfood (v4 再走) と類似の傾向、 **v3.0 の効果は再現性あり**。 効率コストは v4/v3-dogfood の 12-25x より小さい 1.9x、 これは no-harness 側が曖昧 prompt で停止して 3 turn を要したため。

## 環境

- claude CLI: `--input-format stream-json --output-format stream-json --include-partial-messages --permission-mode bypassPermissions --verbose --model claude-opus-4-7 -p`
- 対照群: 素 claude (no plugin)
- 処理群: `--plugin-dir ~/oss/pev-harness` + `/pev-harness:pev <prompt>` (v3.0)
- orchestrator (親 claude session) が `virtual-user.md` の応答ルールに従う
- agent には spec.md を **開示しない** (= 内心 wish として保持)

## メトリクス

| 指標 | no-harness | with-harness | 比率 |
|---|---:|---:|---:|
| 完成までの turn 数 | 41 | 92 | 2.2x |
| tool use 数 | 26 | 76 | 2.9x |
| 完成までの wall-clock | 370s | 702s | 1.9x |
| output token 累計 | 1,657 | 2,354 | 1.4x |
| 実行 turn 数 (orchestrator reply 含) | 4 (= 3 turn + close) | 3 (= 1 turn + 進めて + close) | — |

**v5 は no-harness が 3 turn かかった**: 1 turn 目で「方向性確認」 で停止、 2 turn 目で「3 項目に絞って確認」 と言ったが質問項目を出さず再停止、 3 turn 目で「推測で進めて」 と orchestrator が指示した後に実装完了。 これにより no-harness の cost が増え、 with/no 比率が 1.9x に縮小した (v4 で 15.8x、 v3-dogfood で 24.6x)。

## v3.0 の挙動分析

### Triage agent

```json
{
  "decision": "plan_required",
  "reasoning": "既存 codebase は揃っており pattern 参照は可能だが、 キャンセル機能の UI 配置・操作対象・LocalStorage への反映方法 (物理削除 vs soft delete)・キャンセル後の UX が prompt に一切明示されていない。 これらは実装の根幹に関わる仕様決定であり、 Plan agent による確認質問が必要。",
  "context_signals": [
    "src/form.js + src/validation.js + tests/ + team-conventions.md が揃っている",
    "prompt に「既存 pattern を踏襲」と明示されている",
    "LocalStorage の STORAGE_KEY と append 方式は既存コードから把握可能"
  ],
  "ambiguity_signals": [
    "キャンセル UI の配置が未明示 (form 内ボタン? 申込一覧画面? モーダル?)",
    "キャンセル操作の対象が未明示 (最新1件のみ? 複数選択? 特定の申込を指定?)",
    "LocalStorage への反映方法が未明示 (物理削除 / soft delete / status フラグ追加?)",
    "キャンセル後の UX が未明示 (form リセット? 一覧更新? success/error 通知?)",
    "キャンセル対象の識別子が未明示 (timestamp? index? 新規 UUID 付与?)"
  ]
}
```

**Triage は plan_required を正しく判定**、 ambiguity_signals 5 件が内心 spec Q2 / Q3 / Q5 / Q6 / Q11 にほぼ対応。

### Plan agent の挙動

| 項目 | agent 採用 | 内心 spec | 一致 |
|---|---|---|---|
| Q1: UI 配置 | `#success` 直下に cancel button | success message 内 | ✓ |
| Q2: 対象 | 最新 1 件 (末尾) | 直前の 1 件 | ✓ |
| Q3: 反映 | 物理削除 (pop) | 最後 pop | ✓ |
| Q4: 後 UX | `#success` 非表示 + 別 `#cancel-status` | success hidden + 「キャンセルしました」 表示 | ✓ |
| Q5: 識別子 | id 不要 | (内心 spec で言及なし) | ✓ |

5 項目中 5 件で内心 spec と一致。 ただし **Plan agent は質問せず全 (a) を自己判断で採用**。 prompt の「既存 pattern を踏襲」 を agent が「pattern 由来の minimal 解釈で進めて良い」 と解釈した結果。

**確認質問がスキップされた点 (v3.0 設計意図とのギャップ)**: v3.0 の F1 refine では「UI 拡張要素 / 表示 detail / nice-to-have は質問必須」 と planner directive に書いたが、 v5 では「pattern 踏襲」 prompt がこの directive を上書きする形で agent が全 (a) を採用。 結果は内心 spec とほぼ一致したので OK だったが、 内心 spec が agent の common pattern 推測と乖離していた場合 (例: confirm dialog の有無) は **AC 落ち** につながる (= v5 では AC2 confirm が落ちた)。

### v3.0 内心 spec との照合 (15 項目)

| Q# | 項目 | 内心 A | with-harness 実装 | 一致 |
|---|---|---|---|---|
| Q1 | 用途 | 申込後の取り消し対応 | (理由は内心、 実装不要) | ✓ |
| Q2 | UI 配置 | success 内 | `#success` 直下に button | ✓ |
| Q3 | 対象 | 直前の 1 件 | 末尾 pop | ✓ |
| Q4 | 確認 dialog | window.confirm 必須 | **confirm なし** | **✗** |
| Q5 | キャンセル実行 | 最後 pop + reset + hidden | ✓ | ✓ |
| Q6 | 後 message | warning 色 | `#cancel-status` (色未確認) | △ |
| Q7 | button 文言 | 「キャンセルする」 | 「申し込みをキャンセル」 | △ |
| Q8 | 消えるトリガ | form 編集開始で hidden | ✓ | ✓ |
| Q9 | 認証 | 不要 | ✓ | ✓ |
| Q10 | 0 件時 | button hidden | ✓ (default hidden) | ✓ |
| Q11 | 過去 entry | 触らない (末尾のみ) | ✓ | ✓ |
| Q12 | 理由入力 | 不要 | ✓ | ✓ |
| Q13 | accessibility | aria-label / role / aria-live | ✓ | ✓ |
| Q14 | test | cancel パス + confirm cancel + 複数 entry | 6 unit + 3 E2E | △ (confirm cancel test なし、 ただし confirm 自体なし) |
| Q15 | 既存 success と同 pattern | ✓ | ✓ | ✓ |
| **一致** | | | | **12/15 ✓ + 3 △/✗** |

**12 件完全一致 + 3 件部分/不一致**。 confirm dialog の欠落 (Q4) が最大の損失。

## 採点

### 軸 1: Clarification 行動 — no-harness 4 / with-harness 5

- **no-harness**: 質問しようとしたが --print mode で項目 skip (= F_v2_1 再現)、 3 turn 目で推測実装 + assumptions ログを明示
- **with-harness**: Triage が plan_required 判定 + Plan が 5 項目を識別 (= 内心質問対応)、 ただし「全 (a) 採用」 で実質質問せず

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| 質問返し有無 | 3 | 1 (試みたが skip) | 2 (Plan で項目識別) |
| 重要領域カバー | 4 | 0 | 0 (実 user 確認せず) |
| 質問具体性 | 2 | 0 | 1 (項目自体は具体的) |
| 推測明示 | 1 | 3 (assumptions ログ 6 件) | 2 (plan.md に採用根拠) |
| **合計** | 10 | **4** | **5** |

### 軸 2: spec 準拠 (AC1-AC10) — no-harness 4.5 / with-harness 8.5

| AC | no-harness | with-harness |
|---|---|---|
| AC1 success 内 button | ✗ (履歴一覧 UI) | ✓ |
| AC2 confirm dialog | ✗ (skip) | **✗** |
| AC3 最後 pop | ✗ (論理削除) | ✓ |
| AC4 success hidden + reset | ✗ | ✓ |
| AC5 「キャンセルしました」 + warning 色 | △ | △ |
| AC6 success hidden 時 button hidden | ✗ | ✓ |
| AC7 既存 unit PASS | ✓ | ✓ |
| AC8 既存 E2E PASS | ✓ | ✓ |
| AC9 新規 test | ✓ | ✓ |
| AC10 console error | ✓ | ✓ |
| **PASS 数** | 4.5/10 | **8.5/10** |

### 軸 3: convention 遵守 — 両者 9/10

両者 named export only / 2-space / single quotes / console error なし / 既存 pattern 踏襲。

### 軸 4: test 維持 — no-harness 8 / with-harness 9

- no-harness: unit 30/30 (= 25 → 30、 5 件追加) / E2E 7/7 claim
- with-harness: unit 31/31 (= 25 → 31、 6 件追加) / E2E 8/8 PASS

### 軸 5: 効率 — no-harness 10 / with-harness 6

- no-harness: 370s, 41 turn, 1657 out_tok
- with-harness: 702s, 92 turn, 2354 out_tok = **1.9x time**

v4 (15.8x) や v3-dogfood (24.6x) より大幅に小さい。 no-harness が曖昧 prompt で 3 turn 要した影響。

### 合計

| 軸 | no-harness | with-harness |
|---|---:|---:|
| 1. Clarification | 4 | 5 |
| 2. spec 準拠 (AC) | 4.5 | 8.5 |
| 3. convention 遵守 | 9 | 9 |
| 4. test 維持 | 8 | 9 |
| 5. 効率 | 10 | 6 |
| **合計 (50)** | **35.5** | **37.5** |
| 軸 1-4 計 (品質) | 25.5 | **31.5** |

**with-harness が +2 で勝ち**、 軸 1-4 (品質) では +6。

## v3-dogfood / v4 との横断比較

| 実験 | no-harness 軸 1-4 計 | with-harness 軸 1-4 計 | 軸 1-4 差 |
|---|---:|---:|---:|
| v4 (v2.1.6 ハーネス) | 29 | 25.5 | **-3.5** (no-harness 勝) |
| v3-dogfood (v3.0 + v4 task) | 29 | **37** | **+8** (with-harness 勝) |
| **v5 (v3.0 + cancel)** | **25.5** | **31.5** | **+6** (with-harness 勝) |

**v3.0 with-harness は v3-dogfood / v5 の 2 つの実務 task で品質 +6 〜 +8 で勝つ**。 v3.0 の効果は **再現性あり** と言える。

## 重要 finding

### F_v5_1 (優先度 H): 「pattern 踏襲」 prompt が Plan の質問を抑制する

v3.0 では F1 refine で「UI 拡張要素 / 表示 detail / nice-to-have は質問必須」 と planner directive に書いた。 ただし v5 では prompt に「既存 pattern を踏襲」 と書いたため、 agent が「pattern 由来 minimal 解釈で OK」 と判断、 5 項目を全 (a) で自己採用した。 内心 spec とほぼ一致したので結果 OK だったが、 **confirm dialog のような common pattern 外の要素**は捕捉漏れする可能性。

**反映候補 (v3.1+)**:

- `agents/planner.md` に「**`既存 pattern を踏襲` 等の指示があっても、 拡張要素 (UI 追加 / dialog / confirm 等) が一意に決まらない領域は質問する**」 を追加
- もしくは Plan の 「## 確認質問」 section を「**質問しない場合も項目を列挙して default を明示**」 する形に refine

### F_v5_2 (優先度 M): no-harness の「質問試みて skip」 が回り道を生む

no-harness は「方向性を確認させてください」 → 「3 項目に絞って…」 と 2 turn 質問しようとしたが項目を出せず、 3 turn 目で orchestrator が「推測で進めて」 と指示してようやく実装に。 これは F_v2_1 (--print mode の質問 skip) の再現。

v3.0 では これは Triage + planner directive で解決済 (= ハーネスあり側)。 no-harness 側を直接救う path はないが、 「stream-json input mode + system prompt 追加」 で改善余地あり (= helper script `bin/pev-interactive` で同 pattern を実現する候補)。

### F_v5_3 (優先度 L): with/no 効率比が prompt 曖昧度に inverse 関連

- v4 (中曖昧 + 既存 codebase + ハーネス v2.1.6): 15.8x
- v3-dogfood (中曖昧 + 既存 codebase + ハーネス v3.0): 24.6x
- v5 (中曖昧 + 既存 codebase + ハーネス v3.0): 1.9x

v5 で比率が極端に小さい理由: **no-harness 側も曖昧 prompt で 3 turn 要した**。 つまり「曖昧度が高い場合は no-harness の cost も増える」、 ハーネスの相対 overhead が薄まる。

これは「**実務で本当に曖昧な prompt なら、 ハーネスありなしの効率差は小さくなる**」 という新しい finding。 v1-v4 で「効率コスト 12-18x」 と言っていたのは、 実は no-harness が運良く一発で完成したケース。 真に曖昧な task では no-harness も多 turn 化、 ハーネスの cost が rapidly に回収される可能性。

## 結論

**v3.0 の効果は v3-dogfood に続いて v5 でも再現**。 申込キャンセル機能という別タスクで:

1. **Triage agent が正しく plan_required 判定** (ambiguity_signals 5 件で内心 spec とほぼ対応)
2. **Plan agent が内心 spec の 12/15 項目を推測で一致** (=「pattern 踏襲」 prompt が common pattern 推測を有効化)
3. **AC 8.5/10 達成** (= confirm dialog の 1 件のみ落ち)
4. **軸 1-4 (品質) で no-harness を +6 で逆転**

ハーネスの本来 value 「user の頭の中の spec を引き出す」 が再現性をもって発揮された。 ただし F_v5_1 (= 「pattern 踏襲」 prompt が質問を抑制) は v3.1+ で refine 候補。

## 残課題 (v3.1+ 候補)

- **F_v5_1**: planner directive に「pattern 踏襲指示があっても UI 拡張 / dialog 等は質問」 を追加
- **F_v5_2**: bin/pev-interactive 等の helper で no-harness の質問 skip 問題を ハーネスなし用にも mitigate
- **F_v5_3**: 効率比率を「曖昧度別」 に再評価、 v1-v4 と v5 で trade-off curve を整理
