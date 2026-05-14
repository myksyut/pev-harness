# 実験結果 — harness-effect-v11 (v3.0.5 patch verify、 task_infeasible)

**実施日**: 2026-05-14
**pev-harness version**: v3.0.5 (= F_v10_1 patch 適用済)
**target**: v10 t-infeasible と同じ task (= `src/auth.js` bug 修正、 file 不在) を v3.0.5 で再走、 `task_infeasible` decision が triage.json に出力されるか verify

## TL;DR

**v3.0.5 patch 完璧に functional**:

| 観点 | v10 t-infeasible (v3.0.4) | **v11 (v3.0.5)** |
|---|---|---|
| triage.json 生成 | ✗ (未生成) | **✓ 生成** |
| decision | (なし) | **`task_infeasible`** |
| schema 厳守 (5 field) | (なし) | **✓ 5 field 全部正しい** |
| reasoning | (main 自走の応答のみ) | **「src/auth.js が cwd に存在しない、 codebase domain 不一致」** |
| ambiguity_signals (= missing targets) | (なし) | **4 件** |
| main session 挙動 | triage skip + 自走判定 | **triage invoke → decision parse → user 通知 → exit** |

## v11 triage.json (= patch effect の証跡)

```json
{
  "decision": "task_infeasible",
  "reasoning": "src/auth.js が cwd に存在しない。 codebase は純粋なクライアントサイドのイベント登録フォーム (src/form.js, src/validation.js) のみで構成されており、 token validation / JWT / HTTP response を扱うコードは一切存在しない。 task description の対象 (auth module + token validation + HTTP 200 response) が現プロジェクトの domain と根本的に一致しない。",
  "context_signals": [
    "src/ には form.js と validation.js のみ存在",
    "CLAUDE.md に domain は event registration form (pure client-side) と明記",
    "tests/ は validation.test.js と form.test.js のみ (auth 系テストなし)",
    "server / backend / HTTP handler のコードが存在しない"
  ],
  "ambiguity_signals": [
    "src/auth.js が存在しない",
    "token / JWT / auth 関連の symbol が codebase に存在しない",
    "HTTP 200 を返す server / handler が存在しない",
    "expired token という概念を扱うコードが存在しない"
  ],
  "task_id": "1778724840-d2eeac18"
}
```

**注目**:
- decision = `task_infeasible` (v3.0.4 で triage.md に追加した 3 種類目の decision)
- reasoning が **domain 不一致** まで指摘 (= 単に file 不在だけでなく、 codebase の意図と乖離してる事実を捕捉)
- context_signals 4 件で「なぜ infeasible と判定したか」 の根拠が明確
- ambiguity_signals 4 件で missing target を列挙、 user が confirm しやすい

## main session 応答 (= F_v10_1 patch の証跡)

```text
Triage 判定により PEV pipeline を停止しました。

## [PEV] Phase 0 (Triage): task_infeasible

タスクの対象が cwd に見つかりません。

reasoning: ...
missing targets:
- src/auth.js が存在しない
- token / JWT / auth 関連の symbol が codebase に存在しない
- HTTP 200 を返す server / handler が存在しない
- expired token という概念を扱うコードが存在しない

現プロジェクトに実在する src/:
- src/form.js (submit handler / LocalStorage 永続化 / 二重送信制御)
- src/validation.js (氏名 / email / 電話番号 / プラン / 規約同意 の純粋 validator)

task description を確認してください。 考えられる選択肢:

1. 別プロジェクトでの実行が意図されたもの — cwd を auth module を持つ project に切り替えて再実行
2. 既存ファイルの誤指定 — src/form.js の submit flow や src/validation.js の validator バグだった場合は task description を訂正して再投入
3. 新規実装 — auth module を本当に新設するなら、 その意図を明示した spec で再投入

Plan / Execute / Verify は起動しません。 artifacts/triage.json に詳細を残しました。
```

**観察**:

- v3.0.5 で追加した commands/pev.md の logic がそのまま動作: 「reasoning + missing targets を user 通知して `exit 0`」
- main session が triage agent invoke を **skip せずに完走**、 decision parse → user 通知
- 加えて agent が **建設的な next step を 3 つ提示** (別 project / 誤指定 / 新規実装) — これは prompt directive で書いていないが、 user-facing 価値の高い振る舞い

## v3.0.4 → v3.0.5 の構造改善

| layer | v3.0.4 | v3.0.5 |
|---|---|---|
| triage agent prompt (agents/triage.md) | task_infeasible decision を出すよう directive 追加 | (不変) |
| commands/pev.md (main flow) | triage decision 受領 logic なし (= plan_required / plan_skip のみ) | **task_infeasible 受領 + user 通知 + exit logic 追加** |
| main session 挙動 | 自走で「対象不在 → 停止」 と判定、 triage agent skip | **triage agent を必ず invoke、 decision に従って分岐** |
| 結果 | triage.json 未生成 | **triage.json 完全生成 + structured stop** |

## v3 系 patch series 完了

v3.0 から v3.0.5 までの 6 patch loop:

| version | patch | dog food verify |
|---|---|---|
| v3.0 | Triage 新設 + Plan on-demand + 質問判定強化 + F1 scope 限定 | v3-dogfood + v5 + v6 で実証 |
| v3.0.1 | F_v5_1 (pattern 踏襲指示でも質問必須) | v6 + v3.0.2 docs reflection |
| v3.0.2 | docs align | (= docs-only) |
| v3.0.3 | F_v6_1 (DOM container/text 分離) | v7 (Mode B 実証) |
| v3.0.4 | F_v8_1/2/3 (Triage 強化) | v9 + v10 で部分 verify |
| **v3.0.5** | **F_v10_1 (commands/pev.md と task_infeasible 統合)** | **v11 で完璧 verify** |

**v3 系の patch loop は安定**。 detection (dog food) → patch (agent / commands) → verify (dog food) → 次 detection という cycle が確立。

## 結論

v3.0.5 で v3 系の最終 patch が functional。 task_infeasible の 3 段階防御 (= triage agent prompt + commands main flow + triage.json schema) が完成。

v3.0.x patch series は一旦 complete、 次は v3.1 (新機能 / 大規模変更) のターゲット選定フェーズ。

## v3.1 候補 (CHANGELOG `Planned for v3.1+`)

| ID | 内容 |
|---|---|
| C | Plan-less executor self-clarify |
| D | bin/pev-interactive helper |
| E | F_v7_2 Mode B verify protocol skill 化 |
| F | Gemini CLI 対応 |

これらは v3 系 patch series と異なり「新機能追加」 系。 v3.1 は major 寄りのターゲットになる。
