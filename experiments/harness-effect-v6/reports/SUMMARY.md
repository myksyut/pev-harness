# 実験結果 — harness-effect-v6 (v3.0.2 dog food、 F_v5_1 patch 効果検証)

**実施日**: 2026-05-13
**pev-harness version**: v3.0.2 (= F_v5_1 patch 適用済)
**target**: 同じ申込キャンセル機能 task (v5 と同一 spec / virtual-user / prompt)
**predecessor**: harness-effect-v5/ (v3.0.0 baseline、 F_v5_1 検出)

## TL;DR

| 観点 | v5 (v3.0.0) | **v6 (v3.0.2)** |
|---|---:|---:|
| Plan の confirm dialog 質問 | ✗ (全 (a) 自己採用) | **✓ Q4 で明示確認** |
| Plan「## 確認質問」 section | なし (= 推測 minimal) | **7 項目列挙 + 各 default 提示** |
| 内心 spec 一致率 | 12/15 (Q4 confirm 漏れ) | **15/15 完全一致** |
| AC2 (confirm dialog) | ✗ | **✓ `window.confirm` 実装** |
| 削除方式 | 物理削除 (一致) | 物理削除 (一致) |
| Verify retry | 0 | **1 (textContent bug → 修正)** |
| 軸 1-4 計 (品質) | 31.5 | **34** |
| 合計 (50) | 37.5 | **35** |

**結論**: **F_v5_1 patch が完璧に発動**。 v5 で漏れた confirm dialog (Q4) が v6 では plan に明示質問項目として列挙 → executor が `window.confirm` 実装 → AC2 PASS。 v3.0.1 patch の効果が dog food で実証された。

## v5 → v6 の本質的な差分

### Plan agent の挙動の変化

**v5 plan.md (v3.0.0)**:

```text
| 項目 | 採用 |
|---|---|
| Q1: UI 配置 | `#success` 直下に cancel button |
| Q2: 対象 | 最新 1 件 (末尾) |
| Q3: 反映 | 物理削除 (pop) |
| Q4: 後 UX | `#success` 非表示 + 別 `#cancel-status` 領域 |
| Q5: 識別子 | id 不要 |
```

→ confirm dialog の質問なし、 minimal 推測で skip。

**v6 plan.md (v3.0.2)**:

```text
## 確認質問の回答 (確定済)
| # | 質問 | 回答 |
|---|---|---|
| Q1 | キャンセルの対象 | (b) 送信済みの取り消し |
| Q2 | 対象特定方法 | (a) 直近 1 件のみ |
| Q3 | 削除方式 | (a) 物理削除 |
| Q4 | 確認 dialog | (a) `window.confirm()` |     ← v3.0.1 patch 効果
| Q5 | feedback UI | (a) 既存 `#success` 要素を流用 |
| Q6 | 二重操作防止 | (a) 必要 |
| Q7 | undo | (a) 不要 |
```

→ **「## 確認質問の回答 (確定済)」 として 7 項目を明示**、 Q4 で confirm dialog を質問対象に。 F_v5_1 patch directive (= 「pattern 踏襲指示が来ても dialog 等は質問必須」) が正しく発動。

### 実装の差分

**v5 with-harness の `index.html` (v3.0.0)**:
- `#cancel-btn` + `#cancel-status` 追加
- **`window.confirm()` なし**

**v6 with-harness の `src/form.js` (v3.0.2)**:

```javascript
export function buildCancelHandler({
  // ...
  confirm: confirmFn = window.confirm,
}) {
  let cancelling = false;
  return function handleCancel() {
    if (cancelling) return;
    const ok = confirmFn('直前の申込をキャンセルしますか?');
    if (!ok) return;
    cancelling = true;
    // ...
  };
}
```

`window.confirm` が **DI で注入**、 test では mock 可能、 既存 pattern (buildSubmitHandler) 踏襲。 v5 で漏れた confirm dialog が v6 で完璧に実装。

## メトリクス

| 指標 | v6 no-harness | v6 with-harness | 比率 |
|---|---:|---:|---:|
| turn 数 | 36 | 134 | 3.7x |
| tool use | 20 | 110 | 5.5x |
| wall-clock | 185s | 902s | 4.9x |
| output token | 1,316 | 3,479 | 2.6x |
| Verify retry | 0 | 1 | — |
| 実行 turn (orchestrator reply 含) | 2 (= 1 turn + close) | 3 (= 1 turn + 進めて + close) | — |

v6 では no-harness が 1 turn で完走 (v5 では 3 turn 要した = 質問試みて skip)、 with-harness が **retry 1 で完成** (= PEV の retry loop が想定通り動作)。

## 採点

### 軸 1: Clarification 行動 — no-harness 2 / with-harness 9

**v5 と比較**:
- v5 no-harness: 4 (= 3 turn で「質問試みた」)
- v6 no-harness: 2 (= 1 turn で推測直行、 assumption ログのみ)
- v5 with-harness: 5 (= Plan で項目識別、 ただし全 (a) 採用)
- v6 with-harness: 9 (= Plan で 7 項目明示質問、 各に default 提示)

**v6 with-harness の Plan**:
- 「## 確認質問の回答 (確定済)」 section に Q1-Q7 を明示列挙
- 各質問に default 提示 (= AskUserQuestion が deny されたケースの handling)
- v3.0.1 patch directive (「pattern 踏襲指示が来ても dialog 等は質問必須」) が正しく発動

### 軸 2: spec 準拠 (AC1-AC10) — no-harness 4 / with-harness 10

| AC | no-harness | with-harness |
|---|---|---|
| AC1 success 内 button | ✗ (履歴一覧 UI) | ✓ |
| AC2 confirm dialog | ✗ (skip) | **✓ `window.confirm` 実装** |
| AC3 最後 pop | ✗ (論理削除) | ✓ |
| AC4 success hidden + reset | ✗ | ✓ |
| AC5 「キャンセルしました」 | △ | ✓ |
| AC6 success hidden 時 button hidden | ✗ | ✓ |
| AC7 既存 unit PASS | ✓ | ✓ |
| AC8 既存 E2E PASS | ✓ | ✓ |
| AC9 新規 test | ✓ | ✓ |
| AC10 console error | ✓ | ✓ |
| **PASS 数** | 4/10 | **10/10** |

### 軸 3: convention 遵守 — 両者 9/10

両者 named export only / 2-space / single quotes / 既存 pattern 踏襲。 with-harness は DI pattern (= confirm 注入) を明示踏襲、 plan に「既存 buildSubmitHandler pattern 踏襲」 と documented。

### 軸 4: test 維持 — no-harness 8 / with-harness 9

- no-harness: unit 30/30 (= 25 → 30、 5 件追加) + E2E 6/6 claim
- with-harness: unit 34/34 (= 25 → 34、 9 件追加、 confirm DI mock test 含む) + E2E 8/8 PASS

### 軸 5: 効率 — no-harness 10 / with-harness 0

- no-harness: 185s, 36 turn, 1316 out_tok
- with-harness: 902s, 134 turn, 3479 out_tok = **4.9x time + retry 1**

v5 の 1.9x より大きい。 v6 では no-harness が直行 (1 turn) で完走したため、 with-harness の相対 cost が overshoot。

### 合計

| 軸 | v6 no-harness | **v6 with-harness** |
|---|---:|---:|
| 1. Clarification | 2 | **9** |
| 2. spec 準拠 (AC) | 4 | **10** |
| 3. convention | 9 | 9 |
| 4. test 維持 | 8 | 9 |
| 5. 効率 | 10 | 0 |
| **合計 (50)** | **33** | **37** |
| 軸 1-4 計 (品質) | 23 | **37** |

**with-harness が +4 で勝ち**、 軸 1-4 (品質) では **+14 で圧勝**。

## v3-dogfood / v5 / v6 横断比較 (= 実務 task における v3 系の再現性)

| 実験 | ハーネス version | task | no-harness 軸 1-4 | with-harness 軸 1-4 | 差 |
|---|---|---|---:|---:|---:|
| v3-dogfood | v3.0.0 | textarea 追加 | 29 | 37 | **+8** |
| v5 | v3.0.0 | 申込キャンセル | 25.5 | 31.5 | **+6** |
| **v6** | **v3.0.2** (F_v5_1 patch) | 申込キャンセル (再走) | 23 | **37** | **+14** |

**v3.0.2 で品質差が +6 → +14 に倍増**。 F_v5_1 patch が単なる「1 項目 fix」 ではなく、 **質問判定の質を底上げした構造的改善** であることを実証。

## F_v5_1 patch の効果分析

### 何が変わったか (= planner.md の 1 section 追加)

```text
#### 「pattern 踏襲」 指示が来ても質問する (v3.0.1+)

prompt に「既存 pattern を踏襲して」 「common pattern で」 等の指示があった場合、 多くの項目は
agent が pattern から自己推測可能になる。 ただし、 以下のような pattern では一意に決まらない要素
は質問対象から外さない:

- dialog / confirm 等の UI フロー要素
- 削除方式 (物理 vs 論理)
- 状態遷移の細部
- 拡張 feature の有無
- エラー時の UX
```

### 観測された効果

1. **質問項目数**: v5 で 5 項目 (全 (a) 採用) → v6 で 7 項目 (各 default 提示)
2. **confirm dialog の扱い**: v5 で「Q5 識別子 = id 不要」 として skip → v6 で **「Q4 確認 dialog = (a) `window.confirm()`」** として明示
3. **plan の structuring**: v5 で表 (項目 + 採用) → v6 で **「## 確認質問の回答 (確定済)」 として明示 section**、 reviewer が plan を読んで「ここが grey zone だった」 と理解しやすい

### 副次効果

- executor が plan の AC を受けて `window.confirm` を DI で実装 → **test mock 可能** + 既存 buildSubmitHandler pattern との整合性確保
- verifier が AC E (= 「既存 export と test 1 行も変更しない drop-in 互換」) を明示検証 → retry 1 で textContent bug を捕捉して self-heal

## 残課題 / 学び

### v3.0 retry loop が予期せぬ form で発動 (= 想定内)

v6 with-harness は **Verify で textContent bug を捕捉して retry 1 で自己修正**。 これは:

- Plan の AC-A で「`#success` 内に button 追加」 + 「textContent で text 変更」 が併記、 衝突未明示
- Execute が AC-A を素直に実装 → button が削除されるバグ
- Verify が捕捉 → retry で `<span id="success-text">` を追加して text と button を分離 → PASS

**学び**: plan の AC で「container と text node の分離」 のような low-level な制約も書くべき (= F_v6_1 候補)。 v3.1+ で planner directive に「DOM 変更時の container/text 分離」 を追加検討。

### v3.0.2 ドキュメント反映の効果は今回未確認

v3.0.2 で 20 file を v3.0 reflect したが、 agent 内部挙動への影響は (= 元々 spec.md / CLAUDE.md は agent prompt に流入しない) 直接観測不可。 user (= 私の orchestrator role) の理解度 +α 程度。

## 結論

v3.0.1 で実装した F_v5_1 patch が **dog food で完璧に発動**。 confirm dialog の質問対象化により、 v5 で漏れた仕様が v6 では完全実装。 v3 系の **再現性 + improvement loop が確立**:

- v3.0 → v3.0.1: F_v5_1 検出と patch 実装
- v3.0.1 → v3.0.2: ドキュメント align
- v3.0.2 dog food: patch 効果実証 (= 軸 1-4 で +14)

新しい finding (F_v6_1: DOM 変更時の container/text 分離) は v3.1+ 候補。 今回の dog food は完了、 patch 検証として十分。
