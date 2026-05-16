---
name: linear-issue-workflow
description: Linear Issue (1 PEV task に相当する作業単位) を AI agent が読む・書く・更新するときの規約と template (v3.4.0+)。 project (Why/What 容器) は linear-project-workflow、 issue 単位の PEV pipeline 入出力は pev-linear-sync。 この skill は issue 自身の命名規則 / template / Good-Bad パターンを提供する
---

# linear-issue-workflow (v3.4.0+)

Linear の workspace > team > project > **issue** 階層において、 issue は「**具体的な作業単位**」。 1 issue = 1 PEV task に相当。 project は親、 issue は子。

この skill は AI agent が issue を **読む / 書く / 更新する** ときの規約と template を提供する。 PEV pipeline 経由の sync (= inbound / outbound / issue-first) は `pev-linear-sync` 側、 親 project の理解は `linear-project-workflow` 側。

## When to Use

- AI agent が Linear Issue を **新規作成** する時 (= pev-linear-sync Direction 1.5 issue-first から呼ばれる)
- 既存 Linear Issue を **読んで spec に変換** する時 (= pev-linear-sync inbound から呼ばれる)
- 既存 Linear Issue を **更新** する時 (= 進捗報告 / status 遷移 / 関連 issue link)
- AI agent が「issue の命名規則 / template が分からない」 と困った時

## Linear data model

```text
Workspace (組織)
  └── Team (Engineering, Design, ...)
       └── Project (機能・ユーザーストーリー単位、 Why/What 容器) ← linear-project-workflow
            └── Issue (作業単位、 1 PEV task に相当) ← この skill
```

PEV 対応:

| Linear Layer | PEV 要素 | 担当 skill |
|---|---|---|
| Workspace | 認証スコープ (`.linear-config.yml` の `workspace`) | (config) |
| Team | 規約レイヤー、 status name 解決元 | (config) |
| Project | PEV の Goal + Why + 上位 AC | `linear-project-workflow` |
| **Issue** | **PEV の 1 task (細粒度 AC + 作業ステップ)** | **`linear-issue-workflow`** (この skill) |

## 命名規則 (title)

Issue title は **具体的な作業内容を動詞で表現する** (= How、 「どうする」)。 project title が「Who wants What, Why」 (= 目的) なのに対し、 issue は「**何をする / どうする**」 を端的に書く。

良い例:

- 「validateEmail を RFC 5322 サブセット準拠に拡張する」
- 「ステージング deploy button に確認 dialog を追加する」
- 「重複申込の検出ロジックを `cancelSubmission` に統合する」
- 「`tests-e2e/seed.spec.ts` に console error 監視 fixture を追加する」

悪い例:

- 「RFC 5322」 (= 動詞なし、 何をするか不明)
- 「Email validator を改善する」 (= 「改善」 は曖昧、 何をどう改善か不明)
- 「Various fixes for signup flow」 (= 複数作業の bundle、 1 issue = 1 作業の原則違反)
- 「Refactor」 (= 動詞ではあるが scope 不明)

title 文字数の目安: 15-50 字。 1 issue = 1 作業の境界を保ち、 複数の独立作業を 1 issue に詰め込まない (= 詰め込みたい時は親 project にぶら下げる別 issue に分割)。

## Issue template

Linear Issue の description に以下の構造を使う:

```markdown
## 概要

<何をするのか、 なぜやるのかを 1-3 行で>

## 背景・現状

- 今どうなっているか (= 現状 1-2 文)
- なぜ変える必要があるか (= 動機 1-2 文)

## やること

- <具体的作業 1>
- <具体的作業 2>
- ...

## やらないこと (スコープ外)

- <扱わない範囲 1>
- <扱わない範囲 2>

## 完了条件

- [ ] <検証可能な状態 1>
- [ ] <検証可能な状態 2>

## 参考情報

- 関連 Issue: <ID / link>
- 参考リンク: <URL / doc>
```

### 各 field の AI annotation

| Field | AI 視点で書く | AI 視点で書かない |
|---|---|---|
| **概要** | 1-3 行、 「何を / なぜ」 セット | 機能列挙の長文、 抽象的な意気込み |
| **背景・現状** | 現状の事実 (= 確認可能) + 変更動機 | 「便利になります」 「より良く」 等の主観 |
| **やること** | **動詞で始まる** チェック可能な作業 | 「考える」 「検討する」 等のフワッとした表現 |
| **やらないこと** | 明示的な除外 (= 隣接領域 / 別 issue にすべき範囲) | 空欄 (= 空なら `- なし` と明示) |
| **完了条件** | **検証可能な** チェックリスト、 `- [ ]` checkbox 形式 | 「動作する」 等の漠然とした基準 |
| **参考情報** | 関連 Issue ID + URL、 spec doc / RFC link、 設計 ADR 等 | 空欄なら section ごと省略可 |

### Field 制約

- **概要**: 必須、 1-3 行 (= 約 100-300 字)。 issue を 1 行 sweep する人が把握できる量
- **背景・現状**: 必須、 2 sub-bullet (現状 + 動機) を最低限
- **やること**: 必須、 最低 1 項目、 全項目「動詞で始まる」 表現
- **やらないこと**: 任意セクションだが、 **空なら `- なし` を明示** (= 空欄は AI が「考慮漏れ」 と誤認する)
- **完了条件**: **必須セクション**、 最低 1 項目、 全項目 `- [ ]` 形式 (checkbox markdown)
- **参考情報**: 任意 (= 該当なければ section ごと省略可)

### list bullet 正規化

`linear-project-workflow` と同じ規約 (v1.8+):

- `-` / `*` 両許容、 parse 時に内部で `-` に正規化
- write 時の preview / draft は `-` 形式で統一
- 「正規化前後の文字列 diff」 を理由に rewrite 提案するのは禁止 (空 diff として扱う)

## AI agent operations

### (A) Read — issue を読む

```text
1. mcp__plugin_linear_linear__get_issue(id=<ID>) で issue 取得
2. description を template section に parse:
   ## 概要 / ## 背景・現状 / ## やること / ## やらないこと / ## 完了条件 / ## 参考情報
3. PEV spec に mapping:
   - title → 1 行サマリ (= planner の task title seed)
   - 概要 → planner の Goal seed
   - 背景・現状 → planner の Goal 詳細 + Why
   - やること → planner の File-level changes / Implementation order
   - やらないこと → planner の Constraints (scope 制限)
   - 完了条件 → planner の Acceptance Criteria
   - 参考情報 → planner の関連 file パス hint
```

### (B) Write — 新規 issue を作る

`pev-linear-sync` Direction 1.5 (issue-first) から呼ばれる典型ケース。

```text
1. `.linear-config.yml` から workspace / team.id を読む
2. plan.md (あれば) もしくは task description + triage.json を template の 6 section に整形
3. title を「具体的な作業内容を動詞で表現」 規則で構築:
   - plan.md の Goal 1 行 (= 動詞含む) → title
   - もしくは task description を動詞句に rewrite
4. mcp__plugin_linear_linear__save_issue で新規 issue 作成:
   - team: `.linear-config.yml` の team.id
   - title: 上記
   - description: 6 section template
   - state: "In Progress" 系 (= team workflow から解決)
5. save_issue 戻り値の `gitBranchName` を取得 (v3.3.3+ で pin、 pev-linear-sync 参照)
```

### (C) Update — issue を更新する

```text
状況別:

1. 進捗 report (= PEV PASS / FAIL): pev-linear-sync Direction 2 / 3 経由
2. 細部修正 (= 完了条件 1 項目追加 等): mcp__plugin_linear_linear__save_issue(id=..., description=<新 description>)
3. status 遷移のみ: save_issue(id=..., state="<新 status>")
4. 関連 issue link: save_issue(id=..., relatedTo=[..]) もしくは blockedBy=[..]
```

更新時の規約:

- description を全置換する時は **template 6 section 構造を維持** (= section 削除しない)
- 完了条件の checkbox 更新は description 全置換 (= Linear API は per-checkbox 操作なし)
- 進捗を残したい場合は description 末尾に `## Project notes` section を追加して embed

## Project との関係

issue は必ず parent project を持つことを推奨:

- **project = Why/What 容器**: 「この issue が達成する上位目的」 を context として
- **issue = How 単位**: 「project の完了条件を満たすために具体的に何をするか」

新規 issue 作成時:

1. parent project の `## What` / `## Why` / `## 完了条件` を読む
2. issue が project の完了条件のうち **どの項目に貢献するか** を「概要」 or 「背景・現状」 に明示
3. 親 project がない issue (= 単発 task) も許容、 ただし「概要」 で task の意義を補強する

詳細は `linear-project-workflow` SKILL.md 参照 (= 親 project 操作の規約)。

## pev-linear-sync との責務分離

| 操作 | 担当 |
|---|---|
| Issue の **template 構造定義** (= 命名規則 / section / 制約) | **`linear-issue-workflow`** (この skill) |
| Issue ↔ PEV pipeline の sync (inbound / outbound / issue-first) | `pev-linear-sync` |
| Linear MCP tool の **warmup** (ToolSearch) | `/pev` command (= 上位 command が skill 起動前に実施) |
| 親 project の理解 / 操作 | `linear-project-workflow` |

## Examples

### Good (そのまま AI に流せる)

```markdown
# title: 「`validateInquiry` 純関数を `src/validation.js` に追加する」

## 概要

申込フォームに「ご質問・ご要望」 textarea を追加する project の一環として、 純関数 validator を 1 つ追加する。 既存 validator pattern (validatePhone) を踏襲。

## 背景・現状

- `src/validation.js` には name / email / phone / plan / agreement の 5 validator がある (純関数のみ、 副作用なし)
- 新 textarea は最大 500 文字、 任意項目 (= 空 OK)
- backend / E2E test 互換性のため signature `(value) => string | null` を維持

## やること

- `validateInquiry(value)` を named export で追加 (= validatePhone と同形)
- 500 文字超過時に日本語 error message を返す
- `validateForm` aggregate に `inquiry: validateInquiry(data.inquiry)` を追加
- `tests/validation.test.js` に境界値テスト (0/1/500/501 文字) を追加

## やらないこと (スコープ外)

- index.html への field 追加 (= 別 issue で対応)
- form.js の永続化変更 (= 既存 entry shape 後方互換)
- error message の文言再考 (= 既存 pattern「<項目>は<制約>で入力してください」 を踏襲)

## 完了条件

- [ ] `validateInquiry('')` / `null` / `undefined` が `null` を返す
- [ ] `validateInquiry('a'.repeat(500))` が `null` を返す
- [ ] `validateInquiry('a'.repeat(501))` が「ご質問・ご要望は 500 文字以内で入力してください」 を返す
- [ ] `npm test` で全 vitest 通過

## 参考情報

- 関連 Issue: 親 project の「ご質問・ご要望 textarea 追加」
- 参考リンク: pev-harness team-conventions.md の `src/validation.js` 規約
```

### Bad (AI が困る anti-pattern)

```markdown
# title: 「Validation 改善」                     ← 動詞曖昧、 scope 不明

## 概要

validation を改善する。                          ← 何を / なぜ がない

## 背景・現状

(空)                                            ← section 空、 違反

## やること

- validation を direct する                      ← 動詞曖昧、 「direct」 ?
- 必要に応じて test も更新                       ← 「必要に応じて」 = 曖昧

## やらないこと

(section ごと省略)                              ← 「空なら -なし 明示」 違反

## 完了条件

- きちんと動く                                   ← 検証不能、 checkbox なし

## 参考情報

(なし)
```

問題点:
1. title が動詞なし / scope 不明 (= 命名規則違反)
2. 概要が機能列挙でも user 視点でもなく、 「改善」 だけ
3. 背景・現状が空 (= 空欄違反)
4. やることが曖昧動詞 + 「必要に応じて」 = AI が判断不能
5. やらないこと section ごと省略 (= `- なし` 明示すべき)
6. 完了条件が checkbox なし + 検証不能

## Limitations / 注意

- **1 issue = 1 作業の原則**: 複数の独立作業を 1 issue に詰め込まない (= 親 project に分割 issue として配置)
- **title 長さ**: 50 字超過は description で詳細補強。 title だけで context 取れる 15-40 字が目安
- **status 遷移**: state name は team workflow で異なる、 `.linear-config.yml` の `status_mapping.issue` を参照 (= pev-linear-sync と同 source)
- **template の Linear 公式テンプレ機能との関係**: Linear には公式 issue template 機能があるが、 本 skill の template は **AI agent prompt として直接流せる形** に最適化されたもの。 公式テンプレと併用可

## Related

- `skills/linear-project-workflow/SKILL.md` (= 親 project の規約 + template、 5 section)
- `skills/pev-linear-sync/SKILL.md` (= issue ↔ PEV pipeline sync、 4 direction)
- `skills/linear-project-tracker/SKILL.md` (= project 進捗監視)
- pev-harness SPEC.md §9 `artifacts/linear/`
