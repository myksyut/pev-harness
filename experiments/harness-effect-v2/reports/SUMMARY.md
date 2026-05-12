# 実験結果 — harness-effect-v2 (中程度曖昧 prompt)

**実施日**: 2026-05-12
**model**: claude-opus-4-7 (1M context)
**pev-harness version**: v2.1.6 (F1 Defensive default 原則反映済)
**対象**: TODO アプリ
**初期 prompt**: 「TODO アプリを作ってください。 ブラウザで使えるシンプルなのが欲しいです。」

## TL;DR

| 観点 | no-harness | with-harness |
|---|---:|---:|
| **質問返しの有無** | **なし (推測直行)** | **試みたが --print で skip → 推測進行** |
| 完成までの turn 数 (total) | 12 | **90 (7.5x)** |
| 完成までの wall-clock | 56s | **683s (12.2x)** |
| output token 累計 | 342 | **3,606 (10.5x)** |
| シナリオ S1-S5 (相当の動作) | 全動作 | 全動作 |
| 仮想ユーザー想定要件 一致率 (Q1-Q17) | 14/17 (82%) | **15/17 (88%)** |
| 余計な機能の勝手追加 | フィルタ + 完了クリア (2 件) | **0 件** |
| 監査 artifact (plan.md / verify.json / execute.log) | なし | **完備** |
| **合計 (40 満点)** | **27** | **22** |

**結論**: 中程度曖昧 prompt では、 **絶対値スコアは no-harness が +5 で勝つ** (主因は効率 12x)。 ただし軸 1-3 合計では with-harness が +4 (= 21 vs 17)。 また `--print` non-interactive で **clarification channel が事実上機能しない** 重大 finding。 ハーネスの本来の価値 (= 質問返しで spec を引き出す) が出ていない。

## 環境

- claude CLI: `--print --permission-mode bypassPermissions --output-format stream-json --verbose --include-partial-messages --model claude-opus-4-7`
- 対照群: 素 claude (no plugin)
- 処理群: `--plugin-dir ~/pev-harness` + `/pev-harness:pev <prompt>` (`--force-auto` なし、 質問返しを期待)
- orchestrator (親 claude) が仮想ユーザーとして `virtual-user.md` の応答ルールに従って応答
- 進行: 順次 (no-harness 完走 → with-harness 完走)

## メトリクス table

| 指標 | no-harness | with-harness | 比率 (with/no) |
|---|---:|---:|---:|
| 完成までの turn 数 | 12 | 90 | **7.5x** |
| tool use 数 | 7 | 71 | 10.1x |
| 完成までの wall-clock | 56s | 683s | **12.2x** |
| output token 累計 | 342 | 3,606 | 10.5x |
| cache read 累計 | 377,789 | 3,424,766 | 9.1x |
| cache creation 累計 | 114,346 | 423,086 | 3.7x |
| 仮想ユーザー session turn 数 (orchestrator が応答した回数) | 1 (終了応答のみ) | 1 (続行指示) | — |

(V1 では with/no が 5.0x → V2 では 12.2x。 中程度曖昧 prompt のほうがハーネスの相対 overhead は大きい)

## 採点 — 詳細根拠

### 軸 1: Clarification 行動 — no-harness 1 / with-harness 3

仮想ユーザーは Q1-Q11 の必須機能領域に対する明確な希望を持っているが、 両者とも実質的に質問返しを行わなかった。

**no-harness**: 1 turn 目に「シンプルな TODO アプリを作成します」 と宣言、 直接 `index.html` を Write → `open` で起動まで自走。 質問ゼロ。

**with-harness**:

- turn 1 の最初に **「要件を整形する前に、 いくつか決定軸を確認させてください」** と発言 → 質問返しを意図
- しかし `--print` non-interactive と認識し、 **質問項目を具体的に列挙せず**、 「質問をスキップされたので、 シンプルを最大限尊重した推奨デフォルトで進めます」 と自己判断で planner 起動
- 結果として実際の質問は user に届かなかった (= clarification channel 機能不全)

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| 質問返しの有無 | 3 | 0 | 2 (試みた) |
| Q1-Q11 カバー率 | 4 | 0 | 0 |
| 質問の具体性 | 2 | 0 | 0 |
| 冗長性なし | 1 | 1 | 1 |
| **合計** | 10 | **1** | **3** |

### 軸 2: 推測品質 — no-harness 7 / with-harness 9

両者とも質問せず推測進行したので、 推測内容を仮想ユーザー想定要件 (Q1-Q17) と突き合わせる。

| Q# | 項目 | 想定 A | no-harness | with-harness |
|---|---|---|---|---|
| Q1 | 用途 | 個人用 | ✓ (個人用想定) | ✓ |
| Q2 | データ | localStorage | ✓ | ✓ |
| Q3 | プラットフォーム | web デスクトップ | ✓ (+ モバイル幅対応、 害なし) | ✓ (+ モバイル 375px、 害なし) |
| Q4 | ホスティング | ローカル | ✓ (単一 HTML) | ✓ (単一 HTML) |
| Q5 | 機能 | 追加/完了/削除、 編集なし | ✓ | ✓ |
| Q6 | リスト | 1 つ | ✓ | ✓ |
| Q7 | 期限 | 不要 | ✓ | ✓ |
| Q8 | 優先度/タグ | 不要 | ✓ | ✓ |
| Q9 | 並び替え/検索/フィルタ | **不要** | **✗ フィルタ追加** | ✓ (なし) |
| Q10 | 完了タスク | **別 section + 取り消し可** | ✗ (section 分離なし)、 取り消し可、 **「完了クリア」 = 一括削除も追加 ✗** | ✗ (section 分離なし)、 取り消し可 |
| Q11 | 認証 | 不要 | ✓ | ✓ |
| Q12 | デザイン | お任せ | Apple 風 (◯) | 簡素 (◯) |
| Q13 | 通知 | 不要 | ✓ | ✓ |
| Q14 | 同期 | 不要 | ✓ | ✓ |
| Q15 | テスト | お任せ | なし (◯) | なし (◯) |
| Q16 | 言語/framework | お任せ | vanilla JS (◯) | vanilla JS (◯) |
| Q17 | 起動 | お任せ | open index.html (◯) | open index.html (◯) |
| **一致** | | | **14/17 (82%)** | **15/17 (88%)** |

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| common pattern 踏襲 | 4 | 4 | 4 |
| 一致率 (Q1-Q17) | 3 | 2.5 | 2.6 |
| 不要機能拡張回避 | 2 | 0 (フィルタ + 完了クリア で -2) | 2 |
| 推測明示 | 1 | 0 | 1 (plan.md に Constraints / derived AC を明示) |
| **合計** | 10 | **6.5 → 7** | **9.6 → 9** |

**注目すべき差** = Q9 と Q10 の挙動:

- **Q9 (フィルタ不要)**: no-harness は common TODO アプリパターンに従って `all / active / done` のフィルタを **自発的に追加**。 with-harness は plan.md に Functional Requirements として書かなかったので追加なし
- **Q10 (完了タスクを別 section に + 取り消し可)**: 両者とも「別 section」 は推測不可 (内心 wish なので妥当)。 ただし no-harness はさらに「完了をクリア」 ボタンを追加 → **Q10 と方向性が真逆 (= 完了したものを削除する想定)**

→ **ハーネスの "spec を律儀に転写" 性質が、 余計な機能拡張を抑制する効果として観測された**。 これは F1 (Defensive default) の派生効果。

### 軸 3: 成果物品質 — 両者 9

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| 起動 (1 cmd / 1 click) | 3 | 3 (open index.html) | 3 (同) |
| CRUD (追加/完了/削除) | 3 | 3 | 3 |
| localStorage 永続化 | 2 | 2 | 2 |
| UI 最低限 | 1 | 1 | 1 |
| README | 1 | 0 (なし) | 0 (なし) |
| **合計** | 10 | **9** | **9** |

**rubric 外の加点要素 (with-harness)**:

- XSS 対策が **plan の段階で derived AC として明示** (AC8)、 `textContent` のみで実装、 `innerHTML` 完全不使用
- **二重発火バグの self-review 修正** (`click` event 1 本で書こうとして checkbox の change event と重複 → click と change に分離)。 これは v2.1.6 で導入した **F2 DRY self-review** がそのまま発動した証跡 (execute.log に記録あり)
- localStorage `parse OK でも Array でない` ケースまで defensive check (`Array.isArray(parsed)`)、 save error も catch

no-harness も `JSON.parse` の try/catch は入れているが、 上記 3 点は with-harness 固有の robust 設計。 rubric には含まれていないため数値差は出ないが、 PR submission の品質では with-harness が優位。

### 軸 4: 効率 — no-harness 10 / with-harness 1

with/no 倍率:

- wall-clock: 12.2x
- turn 数: 7.5x
- output token: 10.5x

12 倍は中程度曖昧 prompt では厳しい。 ハーネスは Plan agent (opus xhigh) + Execute agent + Verify agent + main orchestration の 4 layer が動くため、 シンプル task ではオーバーヘッドが overshoot。

| 観点 | 配点 | no-harness | with-harness |
|---|---:|---:|---:|
| turn 数 (相対) | 4 | 4 | 0 |
| wall-clock (相対) | 3 | 3 | 0 |
| token 消費 (相対) | 3 | 3 | 1 (極端な差を考慮して punitive ではないが低) |
| **合計** | 10 | **10** | **1** |

### 合計

| 軸 | no-harness | with-harness |
|---|---:|---:|
| 1. Clarification | 1 | 3 |
| 2. 推測品質 | 7 | 9 |
| 3. 成果物品質 | 9 | 9 |
| 4. 効率 | 10 | 1 |
| **合計 (40)** | **27** | **22** |
| 軸 1-3 計 | 17 | **21** |

**軸 1-3 では with-harness が +4 (品質面で有利)、 軸 4 (効率) で no-harness が +9。 合計は no-harness +5**。

## v1 (明確 prompt) との対比

| 観点 | v1 (明確 prompt) | v2 (曖昧 prompt) |
|---|---|---|
| no-harness 合計 | 33 | 27 |
| with-harness 合計 | 33 | 22 |
| 差 (with - no) | 0 (同点) | -5 |
| with/no 経過秒比 | 2.9x | **12.2x** |
| 質問返しが起きたか | (該当なし、 spec 明確) | **両者とも実質ゼロ** |

**重要な学び**: 中程度曖昧 prompt では、 V1 では拮抗していたバランスが **no-harness 圧勝に傾く**。 これはハーネスの最大の価値である「曖昧入力に対する clarification」 が **--print non-interactive mode で機能しない** 制約に直結している。

## findings (v2.2+ への反映候補)

### F_v2_1 (優先度 H): `--print` mode で planner の質問返しが skip される

planner agent ([agents/planner.md L22](../../../agents/planner.md)) は「3 つの必須要素のいずれかが欠けている場合、 コードを 1 行も読まずにまず質問返しする」 と明記。 だが --print non-interactive で起動された場合、 planner は質問を投げる代わりに **「ユーザーから応答が来ない」 と判断して自発的に "推奨デフォルト" で進める**。

ログ証拠 (`logs/with-harness/turn1.stream.jsonl` から):

```
要件を整形する前に、いくつか決定軸を確認させてください。
[...]
質問をスキップされたので、「シンプル」を最大限尊重した推奨デフォルト
（純 HTML+JS / localStorage / MVP 操作のみ）で進めます。
```

これは planner.md の入力契約と矛盾。 期待される挙動は:

1. planner が質問を user に投げる
2. **--print mode では pipeline を suspend** して plan.md に「質問待ち」 status を書く、 exit 0
3. user が `claude -c` で resume + 応答 prompt を送る
4. planner が response を受けて plan.md 確定 → 通常 flow

**反映候補**:

- `agents/planner.md` に「--print mode で必須要素が欠ける場合は plan.md に質問だけ書いて exit、 pipeline を停止」 directive を追加
- `commands/pev.md` の Step 2 (Plan) の後に「plan.md status が `questions_pending` なら Gate A 相当の停止 + 質問内容を user に提示」 logic を追加
- 同等に Phase 1 でユーザーから明確な応答得るまで Phase 2 を blocking

### F_v2_2 (優先度 M): ハーネスは「余計な機能の勝手追加」 を抑制する効果あり

v1 では observe しにくかった効果。 v2 で明確化:

- no-harness は common TODO pattern に従ってフィルタ + 完了クリアを自発追加
- with-harness は plan.md の AC 範囲外を実装しなかった

これは F1 (Defensive default) と並ぶハーネスの "yes-bias 抑制" 効果。 採点軸として未反映だが、 SPEC.md の design rationale に書く価値あり (= ハーネスの value proposition の 1 つ)。

### F_v2_3 (優先度 L): 内心 wish の推測不可能性

仮想ユーザーが「内心の wish」 (Q10 完了タスクを別 section + 取り消し可) を明示しない限り、 ハーネスありなしどちらも推測できない。 これは「明示的に言わない要件は LLM に伝わらない」 という当然の知見。 仕様化を促す clarification の重要性を裏付ける。

### F_v2_4 (優先度 M): 効率差の prompt 複雑度依存

| prompt 複雑度 | V1 (明確 WebSocket chat) | V2 (曖昧 TODO アプリ) |
|---|---|---|
| with/no 経過秒比 | 5.0x → 2.9x (v2.1.6 後) | 12.2x |

ハーネスの相対 overhead は **task が単純なほど大きく見える**。 これは Plan/Verify の固定コストが小 task では amortize しにくいため。 用途別推奨を refine:

- **超単純 task (1-2 ファイルで完結)**: 素 claude で十分、 12x overhead は割に合わない
- **中規模 task (5-10 ファイル + test)**: ハーネスが拮抗、 監査価値あり
- **複雑 task (20+ ファイル / 多境界条件)**: ハーネスの clarification + Plan + Verify がコスト回収

### F_v2_5 (優先度 H): F1 (Defensive default) と F_v2_1 (質問 skip) の相互作用

v2.1.6 で planner に「不明確 → defensive 拒否」 を default にする F1 directive を入れた。 これは spec が一定の情報量を持つことが前提。 完全に曖昧な prompt (= Goal だけある状態) では:

- F1 は機能しない (= AC が何も書けない)
- 質問返し channel も機能しない (= --print mode skip)
- 結果として「シンプル尊重デフォルト」 で進む

つまり **F1 と F_v2_1 を両方解決して初めて、 ハーネスが「曖昧入力 → 質問 → 構造化 spec → 実装」 の本来 flow を実現できる**。 F_v2_1 が先に必要。

## 結論

中程度曖昧な prompt 下では:

1. **opus 4.7 は素のままで "凡庸に良い" TODO アプリを 1 turn / 56 秒で生成できる**。 仕様未指定の部分は common pattern (フィルタ等) で勝手に補完する性質あり (= 推測拡張バイアス)
2. **ハーネスは "余計な追加を抑制" する性質を見せた**。 plan.md に明示しない機能は実装しない。 これは v2.1.6 で入れた Defensive default 原則の派生効果
3. **ただしハーネスの本来価値である "質問返しで spec を引き出す" は --print mode で機能不全**。 F_v2_1 (planner が non-interactive で skip 挙動) が阻害要因
4. **絶対値スコアでは no-harness が +5 で勝つ** が、 軸 1-3 では with-harness +4。 効率の差 (12x) が支配的
5. **次の release (v2.2 or v2.1.7) で F_v2_1 (--print mode での質問返し handling) を解決すべき**。 これによりハーネスは曖昧入力 task で本領発揮可能になる見込み

## 残課題

- F_v2_1 反映 (planner の --print mode 対応、 commands/pev.md の Gate A 前段に質問停止 logic)
- F_v2_2 を SPEC.md の design rationale に成文化 (ハーネスの value proposition として)
- v3 として「曖昧 prompt + interactive mode」 (claude -r で本物の対話) で再走、 F_v2_1 解決後の挙動確認
