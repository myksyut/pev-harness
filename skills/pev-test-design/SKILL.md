---
name: pev-test-design
description: AC (Acceptance Criteria) を 6 つの古典 QA 技法 (同値分割 / 境界値分析 / デシジョンテーブル / 状態遷移 / エラー推測 / チェックリスト) で分析し、 不足を warning、 派生テスト観点を提案する skill。 AI 時代に「テストの量より質」を担保する観点設計層。 planner / verifier から auto-dispatch される (Phase 1 で AC レビュー、 Phase 3 で派生テスト実行)。
---

# pev-test-design

「AC が薄い」「テスト観点が漏れている」 状態を自動検出して plan / verify の質を底上げする skill。 古典 QA 技法 6 種を AC に適用し、 派生テスト観点を **planner に inject** したり、 **verifier に追加 check** として渡す。

参照: 外山@frontLineLLC, "AI駆動開発時代に、おさえておきたいQA技法", Zenn (2026-05-06)

## When to Use

起動すべき場面:

- planner agent が plan.md 生成時 (Phase 1 で AC を review、 不足を warning)
- verifier agent が AC を check する直前 (Phase 3 で派生テスト観点を追加)
- ユーザーが `/pev-test-design <issue-url>` を明示的に呼んだ時
- AC に **QA-trigger keyword** が含まれる時 (auto-dispatch):
  - 数値・範囲系: `1〜N`、 `between A and B`、 `min/max`、 `limit`、 `range`、 `人数`、 `件数`
  - 状態系: `状態`、 `権限`、 `permission`、 `role`、 `enabled/disabled`、 `active/inactive`
  - 多条件系: `or`、 `and`、 `かつ`、 `または`、 `if`、 `when`
  - 失敗系: `error`、 `失敗`、 `timeout`、 `retry`、 `rollback`

起動すべきでない場面:

- 1 行の trivial AC (例: "typo を修正する") → overhead に見合わない
- AC が既に test 観点込みで十分詳細

## 6 QA 技法 (適用フロー)

### 1. 同値分割 (Equivalence Partitioning)

**目的**: 同じように扱われる入力をグループ化、 各グループの代表値で検証。

**適用**: AC が値の **範囲** や **カテゴリ** を含む時。

**例**: AC「予約人数 1-4 名を入力できる」

派生:
```text
- 無効グループ (n <= 0): 代表値 -1, 0
- 有効グループ (1 <= n <= 4): 代表値 2, 3
- 無効グループ (n >= 5): 代表値 5, 999
```

skill が plan.md の Verification strategy に追加: 「同値分割: 3 groups、 代表値 5 件を check」

### 2. 境界値分析 (Boundary Value Analysis)

**目的**: 境界の前後 (off-by-one 系) のバグを検出。

**適用**: 同値分割の groups に境界がある時 (必ず併用)。

**例**: AC「予約人数 1-4 名」

派生境界値:
```text
- 0 / 1 (下境界、 invalid / valid)
- 4 / 5 (上境界、 valid / invalid)
```

skill が plan.md に追加: 「境界値: 0, 1, 4, 5 の 4 点を必ず check」

### 3. デシジョンテーブル (Decision Table)

**目的**: 複数条件の **組み合わせ** を表形式で網羅。

**適用**: AC に 2 つ以上の条件 (AND/OR) がある時。

**例**: AC「メール通知: 予約確定済 AND 通知 ON AND メールアドレス登録済 のとき送信」

派生:
```text
| # | 予約確定 | 通知ON | メール登録 | 期待結果 |
|---|---------|--------|-----------|---------|
| 1 | Yes     | Yes    | Yes       | 送信    |
| 2 | Yes     | Yes    | No        | 未送信  |
| 3 | Yes     | No     | Yes       | 未送信  |
| 4 | No      | Yes    | Yes       | 未送信  |
| 5 | No      | No     | No        | 未送信  |
| ... 計 2^3 = 8 通り (or 必要な subset) |
```

skill が plan.md に table を埋め込み、 「全 8 通り中、 必要な test cases を選定」 と提案。

### 4. 状態遷移テスト (State Transition)

**目的**: 業務ロジックの **状態間遷移** で許可・禁止される transition を検証。

**適用**: AC に **状態名** (Draft / Published / Archived 等) や **status 遷移** が含まれる時。

**例**: AC「Draft → Published に遷移可能、 Published → Draft は不可」

派生:
```text
状態遷移図:
  Draft --publish--> Published
  Published --archive--> Archived
  Published --✗--> Draft  (禁止)
  Archived --✗--> Draft  (禁止)

派生テスト:
- happy path: Draft → Published → Archived
- 禁止遷移試行: Published → Draft (拒否されること)
- idempotent: 既に Published のものを再度 publish (no-op or error)
```

### 5. エラー推測 (Error Guessing)

**目的**: 過去事例から **危険なパターン** を予測。

**適用**: 全 AC で常に実施 (catalog ベース)。

`rules/error-patterns.md` の catalog を参照。 代表的:

- 二重送信 (clicks を素早く 2 回)
- 戻る操作後の再送信
- API 失敗時の中途半端な状態 (UI は成功表示だが DB 反映なし)
- timeout / network 切断
- 並行更新 (race condition)
- 巨大 payload (1MB 以上の input)

skill が plan.md の Risks セクションに「Error guessing: 関連 risks 3-5 件」 を追加。

### 6. チェックリスト化 (Checklist)

**目的**: テスト観点をテンプレート化し再現性を確保。

**適用**: 画面実装 / API実装 / DB操作 / E2E 等のカテゴリごとに template を使う。

`templates/qa-checklists/` から該当カテゴリの template を読み、 plan.md の Verification strategy に転記。

例: 画面実装の checklist:
- 正常系動作確認
- バリデーションエラー表示
- ローディング中の二重送信防止
- 権限制御の動作
- API失敗時の UI 安定性
- 成功表示と実データの一致
- モバイル表示対応
- コンソールエラーの有無

## AC 不足の自動検出

skill が起動すると、 まず AC を分析して以下を検出:

| 検出項目 | 警告例 |
|---|---|
| 同値分割の代表値が不足 | "AC が値の範囲 (1-4) を扱うが、 境界値 (0, 5) の挙動が AC にない。 追加検討を推奨" |
| デシジョンテーブルの空白セル | "AC に 3 条件 (確定 / 通知 / 登録) があるが、 'No, No, No' の組合せの期待結果が未記述" |
| 状態遷移の禁止 transition 未記述 | "AC が遷移を許可するが、 禁止 transition が記述されていない (security リスク)" |
| エラー推測 catalog の未対応 | "AC に二重送信防止の記述なし。 form 系画面の知見ベースで追加推奨" |
| Checklist カテゴリ未指定 | "AC のカテゴリ (画面/API/DB) を特定できない、 template 自動選択不能" |

warning は plan.md に明示 + planner に retry を促す (Phase 1 で改善ループ)。

## planner との連携 (Phase 1)

`pev-test-design` skill は planner agent の AC レビュー sub-step として呼ばれる:

```text
1. planner が初期 AC を draft
2. pev-test-design が 6 技法で AC を分析
3. 不足検出 → planner にfeedback (AC 拡張提案)
4. planner が AC を改訂
5. plan.md に "Test design analysis" section を追加 (適用した技法 + 派生観点)
6. planner が ~/.claude/pev/{TASK_ID}/notes.md にも要旨を反映 (cross-phase channel)
```

### planner → executor / verifier cross-phase handoff (v1.6+ documentation)

dog food (v1.4+v1.5) で、 planner が `pev-subagent-memory` skill の標準 path `~/.claude/pev/{TASK_ID}/notes.md` に書いた内容を、 executor / verifier が読む handoff 経路が実機で機能することを確認。 v1.6 で正式に documented:

| Channel | Content | Producer | Consumer |
|---|---|---|---|
| `artifacts/plan.md` の `## Test design analysis` | 6 技法の適用結果、 D1-Dn の qa_derived_checks 一覧 | planner (pev-test-design 経由) | verifier (Phase 3 で check) |
| `~/.claude/pev/{TASK_ID}/notes.md` の "Notes for executor" / "Notes for verifier" | 派生観点の意図、 実装注意点、 verifier への check 委譲メモ | planner (pev-subagent-memory 経由) | executor / verifier |
| `~/.claude/pev/{TASK_ID}/executor-{N}.md` | 実装中の発見 (例: input validation を HTML5 で実装) | executor | verifier |

planner は **両方** に書く責務 (plan.md は authoritative spec、 notes.md は agent 間の informal handoff)。 verifier は plan.md を必ず read、 notes.md は補助として参照。

## verifier との連携 (Phase 3)

verifier が AC を 1 つずつ check する際、 pev-test-design 由来の派生テスト観点も check 対象に含める:

```text
- 元 AC: "予約人数 1-4 名を入力できる"
- 派生 (境界値): 0 / 1 / 4 / 5 を実際に input して挙動確認
- 派生 (エラー推測): 二重送信防止が動作するか
```

verify.json には:
```json
{
  "acceptance_criteria": [
    {"criterion": "1-4 名を入力できる", "met": true, "evidence": "..."}
  ],
  "qa_derived_checks": [
    {
      "id": "D1",
      "technique": "boundary",
      "case": "input 0",
      "result": "PASS",
      "evidence_type": "actual_execution",
      "evidence": "playwright: input(0) → 'Out of range (1-10)' visible (tests-e2e/multiply.spec.ts:23)"
    },
    {
      "id": "D8",
      "technique": "boundary",
      "case": "mirror of D1 (input position swapped)",
      "result": "PASS",
      "evidence_type": "mirror_of",
      "mirror_of": "D1",
      "evidence": "Compressed: same semantics as D1 (validation on either input), single test covers both via parameterization"
    },
    {
      "id": "D14",
      "technique": "decision_table",
      "case": "row 4: both invalid",
      "result": "PASS",
      "evidence_type": "code_inspection",
      "evidence": "isValid() guards `if (!isValid(a) || !isValid(b))` → first invalid short-circuits; row 4 path identical to row 2/3"
    }
  ]
}
```

### qa_derived_checks schema (v1.6+)

各 check は以下の構造:

| Field | Type | Description |
|---|---|---|
| `id` | string | Plan 内の ID (例: `D1`, `D2`)。 verifier がplan.md の "Test design analysis" section と一意対応させる |
| `technique` | string | `equivalence_partitioning` / `boundary` / `decision_table` / `state_transition` / `error_guessing` / `checklist` |
| `case` | string | 具体的な test case の人間可読な説明 |
| `result` | `PASS` / `FAIL` | 判定 |
| `evidence_type` | enum | 下記参照 (v1.6 で追加) |
| `evidence` | string | 判定の根拠 (test ファイル行番号、 log 抜粋、 code 抜粋) |
| `mirror_of` | string (optional) | `evidence_type=mirror_of` のときの参照先 check id |

### evidence_type enum (v1.6+)

| Value | 意味 | When to use |
|---|---|---|
| `actual_execution` | 実機で test を走らせて確認 | Playwright test、 vitest assertion 等 |
| `code_inspection` | source code を読んで logic 上 PASS と判定 | trivial case、 mirror semantics、 short-circuit logic |
| `logical_derivation` | 他の check 結果から論理的に導出 | 等値類の中の代表値が PASS なら、 同じ class の他値も PASS と推論 |
| `mirror_of` | 別の check の mirror (parameter swap 等) | `mirror_of` field で参照 case を指定、 圧縮目的 |

`actual_execution` が一番強い、 `mirror_of` / `logical_derivation` は token / 実行時間 節約のための圧縮手段。 verifier が selecting する基準:

- AC で「必ず実機 test」 が暗示される項目 → `actual_execution`
- 同じ semantics を別 parameter で確認 (mirror、 swapped、 等値類内) → `mirror_of` or `logical_derivation`
- code の論理が単純で読めば自明 → `code_inspection`

### Mirror compression rule (v1.6+、 finding from dog food)

dog food (v1.4+v1.5、 multiply 機能) で、 境界値 mirror test (例: `(0, 5)` と `(5, 0)`) が intent 同じで重複気味と判明。 圧縮ルール:

1. **同 technique 同 semantics の mirror** は **1 つを `actual_execution` で必須**、 もう片方は `mirror_of` で省略
2. 例: `D1: (0, 5)` を実機テストし、 `D8: (5, 0)` は `mirror_of: D1` で skip
3. ただし、 mirror 関係が **非対称** (例: 順序依存ロジック、 transaction の前後関係) のときは両方 `actual_execution`

planner が plan.md の "Test design analysis" section で **mirror pair を明示** すれば、 verifier が自動で圧縮可能:

```markdown
### 2. Boundary value analysis

Single-input boundary tests (mirror with the other input held at valid mid-range = 5):

- `(0, 5)` / mirror `(5, 0)` — invalid-low
- `(1, 5)` / mirror `(5, 1)` — valid-low
- `(10, 5)` / mirror `(5, 10)` — valid-high
- `(11, 5)` / mirror `(5, 11)` — invalid-high

Mirror pairs share semantics (both inputs are validated identically). Verifier should execute one of each pair (`actual_execution`) and mark the mirror as `mirror_of`.
```

これで qa_derived_checks の数が 8 → 4 + 4 mirror references = compact になる。

## Bootstrap fallback

skill が起動した時、 `templates/qa-checklists/` や `rules/error-patterns.md` が無い場合は warning + default 内蔵リスト (この SKILL.md の例示) を fallback として使う。 setup が完了しているプロジェクトでは template / catalog が拡張される。

## Examples

### Example 1: 予約人数 AC (同値分割 + 境界値)

```text
入力 AC:
- "予約人数として 1-4 名を選択できる"

pev-test-design 出力 (plan.md "Test design analysis" section):
- 同値分割: 3 groups (n<=0 invalid, 1<=n<=4 valid, n>=5 invalid)
- 境界値: 0, 1, 4, 5 を check
- 派生テスト追加: 「人数 5 名で submit すると invalid メッセージ表示」 (verifier の追加 AC)
```

### Example 2: メール送信デシジョンテーブル

```text
入力 AC:
- "予約確定 AND 通知 ON AND メール登録済のときメール送信"

pev-test-design 出力:
- デシジョンテーブル: 2^3 = 8 通り (subset 5 件を推奨)
- 警告: AC に 'No, No, No' の組合せの期待挙動が未記述、 planner に追加検討を求める
```

### Example 3: 状態遷移 (Draft / Published)

```text
入力 AC:
- "Draft の記事を Published に変更できる"

pev-test-design 出力:
- 状態遷移図 生成: Draft → Published
- 禁止 transition 検出推奨: Published → Draft が「許可」か「禁止」か AC で曖昧
- 派生テスト: "Published → Draft 試行で拒否されること" を AC に追加提案
```

## Limitations

- **AC が日本語のとき NLP 精度が下がる**: keyword match base なので、 自然な日本語の AC では false negative あり (例: "ぐらい"、 "程度" 等の曖昧表現)
- **複雑なドメイン特化ロジック** (例: 金融計算、 医療判定) は 6 技法だけでは網羅不能 → エキスパート知見を team-conventions.md に蓄積
- **6 技法の適用優先度** はカテゴリ依存 (画面: チェックリスト主、 API: デシジョンテーブル主、 DB migration: 状態遷移主)

## Related

- [`rules/error-patterns.md`](../../rules/error-patterns.md) — エラー推測 catalog (v1.5+)
- [`templates/qa-checklists/`](../../templates/qa-checklists/) — チェックリスト library (v1.5+)
- [`agents/planner.md`](../../agents/planner.md) — Phase 1 で AC レビュー時に呼ぶ
- [`agents/verifier.md`](../../agents/verifier.md) — Phase 3 で派生テスト観点も check
- 参考記事: [外山, "AI駆動開発時代に、おさえておきたいQA技法", Zenn (2026-05-06)](https://zenn.dev/frontline/articles/3a912df20d9210)
