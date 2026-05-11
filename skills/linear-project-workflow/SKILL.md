---
name: linear-project-workflow
description: Linear Project (機能・ユーザーストーリー単位の Why/What 容器) を AI agent が読む・書く・更新するときの規約と template。 1 issue で完結する作業は対象外 (linear-issue-workflow を使う)。 進捗監視は linear-project-tracker に委ねるが、 必要な場面では status 遷移も担う。
---

# linear-project-workflow

Linear の workspace > team > **project** > issue 階層において、 project は「**機能・ユーザーストーリー単位の Why/What 容器**」。 issue は project の child 作業単位。

この skill は AI agent が project を **読む / 書く / 更新する** ときの規約と template を提供する。

## When to Use

起動すべき場面:

- 機能・ユーザーストーリー単位の Linear Project を起票する時
- ユーザーが「Project を作って」と明示した時
- 複数 issue を束ねる必要が見えた時 (例: 1 機能に対し backend / frontend / test の 3 issue がぶら下がる)
- 既存 project を読んで PEV pipeline の context にする時
- project の完了条件 checkbox を更新する時

起動すべきでない場面:

- 1 issue で完結する作業 (例: typo 修正、 1 関数追加) → `linear-issue-workflow`
- 既存 project の status 遷移を「進捗監視として」判断する時 → `linear-project-tracker` (主責任)
- PEV pipeline と Linear Issue の sync → `pev-linear-sync`

## Preflight check (v1.3.0+ 必須)

skill 起動直後、 以下の preflight を実行する。 不整合があれば silent corruption を防ぐため早期に止める:

1. **`.linear-config.yml` 存在確認**
   - 不在: warning + Read 系操作は degraded fallback (workspace/team.id 不在で機能制限) / Write 系操作は **hard fail** (configなしで Linear に書くと workspace 混在のリスク)

2. **team.id 整合性検査** (Write 系操作前は必須)
   - `mcp__plugin_linear_linear__get_team(query=yaml.team.id)` で取得
   - 取得 entity の `key` または `id` と yaml.team.id を比較
   - 不一致: **hard fail** (silent corruption 防止、 別 team の Linear に書くリスク)

3. **status workflow preflight**
   - `mcp__plugin_linear_linear__list_issue_statuses(team=yaml.team.id)` で取得
   - yaml の `status_mapping.issue.*` 値が Linear に存在しない場合は warning
   - Project state は固定 5 種 (`backlog / planned / started / completed / canceled`) なので別管理
   - `.linear-config.yml` で `status_mapping.use_type: true` (任意、 default `false`) が指定されている場合、 status name ではなく state object の `type` field (locale-independent) を優先 lookup する。 詳細は下記 「Status lookup mode (v1.8+)」 参照

4. **(Write 系のみ) workspace permission probe**
   - 軽微な API call (例: `list_projects` limit=1) で write 権限の sanity check
   - 失敗時: 該当 error 種別を「MCP error handling」表に従って処理

dog food 結果 (Phase 4-1 / 4-2 / 4-3) で preflight 不在が **silent corruption** を生むことが実証されたため、 v1.3 では preflight を **必須** に格上げ。

## MCP error handling (v1.3.0+ 必須)

Linear MCP tool が返しうる error 種別と skill 挙動:

| Error type | Trigger | Skill 挙動 | Retry budget |
|---|---|---|---|
| `404 / Entity not found` | 存在しない issue/project ID | warning + fallback to `pev-spec-template` (manual spec collection) | 0 (即 fallback) |
| `PERMISSION_DENIED` | token に write 権限なし、 visibility/scope 違反 | **hard fail** + 具体的 error msg + preview-only mode 提案 | 0 |
| `NETWORK / TIMEOUT` | 一時的 network 問題 | exponential backoff retry | 3 (15s/30s/60s) |
| `GRAPHQL_ERROR` (HTTP 200 + `errors[]`) | API validation failure、 workspace 設定依存 (例: status_update disabled) | error type を上表に look up、 該当 row へ | 0 |
| `VALIDATION` | 引数不正 (例: state名が Linear に存在しない) | warning + `status_mapping fallback chain` (`Released → Done → Completed`) を試行、 全失敗なら skip | 0 |
| `RATE_LIMIT` | Linear API rate limit | exp backoff + retry | 3 |

**規約**: ad-hoc error handling は禁止。 全 MCP tool 呼び出しは上表に従う。 fallback の発火時は `sync_state.json` の `error_log[]` に記録 (`{at, tool, error_type, action}`)。

## Status lookup mode (v1.8+)

Linear API の state object は `name` (locale-dependent) と `type` (locale-independent enum) の 2 field を持つ。 例:

```yaml
# 英 workspace
{ name: "In Progress", type: "started" }
# 日 workspace
{ name: "進行中",     type: "started" }
```

`.linear-config.yml` の `status_mapping` には 2 つの lookup mode がある:

| Mode | yaml 設定 | 挙動 |
|---|---|---|
| **name-based** (default) | `use_type: false` または未指定 | `status_mapping.issue.in_progress: "In Progress"` のような name 文字列で lookup。 v1.3 までと同じ |
| **type-based** (v1.8+) | `use_type: true` | `status_mapping.issue.in_progress: "started"` のような type enum で lookup。 ロケール非依存 |

**type enum 一覧** (Issue / Project 共通):

- `backlog` — まだ着手していない、 優先度未確定
- `unstarted` — 着手可能だが未着手 (Linear 用語 "Todo")
- `started` — 着手中 (Linear 用語 "In Progress" / "進行中")
- `completed` — 完了 (Linear 用語 "Done" / "完了")
- `canceled` — 中止・破棄

**運用ガイド**:

- 多国籍 team、 workspace 言語切替リスクのある環境では `use_type: true` 推奨
- 単一言語 workspace で「Released」「Shipped」のような custom name を使う team は `use_type: false` (name-based) のまま、 fallback chain (`Released → Done → Completed`) で吸収
- mode 切替時は `mcp__plugin_linear_linear__list_issue_statuses` で実際の `(name, type)` pair を確認してから yaml 更新

**type-based 時の挙動**:

1. `list_issue_statuses` で取得した state 配列から `type === yaml.status_mapping.issue.<key>` で match
2. 同一 type の state が複数ある場合 (Linear で許容) は **最初の 1 件** を採用、 sync_state.json の `notes[]` に「複数候補から first match を採用」を記録
3. type が存在しない場合は VALIDATION error として fallback chain (yaml.status_mapping.fallback) 試行

## Linear data model

```text
Workspace (組織)
  └── Team (Engineering, Design, ...)
       └── Project (機能・ユーザーストーリー単位、 Why/What を持つ)
            └── Issue (作業単位、 1 PEV task に相当)
```

PEV 対応:

| Linear Layer | PEV 要素 |
|---|---|
| Workspace | 認証スコープ (`.linear-config.yml` の `workspace`) |
| Team | 規約レイヤー (`team-conventions.md`)、 status name 解決元 |
| **Project** | PEV の **Goal + Why + 上位 AC** |
| Issue | PEV の 1 task (細粒度 AC + 作業ステップ) |

## Project template

Linear Project の description に以下の構造を使う:

```markdown
## Who (誰のために)
<対象 audience を 1-2 文で>

## What (何を実現するか)
<ユーザーアウトカム視点、 「ユーザーが〇〇できる」形式>

## Why (なぜやるのか)
<今このタイミングで取り組む理由、 ビジネス背景、 制約>

## 完了条件 (Acceptance Criteria)
- [ ] <検証可能な状態1>
- [ ] <検証可能な状態2>
- [ ] 関連 issue 全て Done

## スコープ外 (Out of scope)
- <扱わないこと>
```

### 各 field の AI annotation

| Field | AI 視点で書く | AI 視点で書かない |
|---|---|---|
| **Who** | 具体的な audience (役割、 人数感) | "Everyone" / "All users" の曖昧表現 |
| **What** | **ユーザー視点**のアウトカム ("〇〇できる" "〇〇が見える") | 機能列挙 ("Add button X、 Add table Y") |
| **Why** | ビジネス背景 + 時間制約 (なぜ今やる) | "Improve UX" のような抽象表現、 単なる "Users want it" |
| **完了条件** | **検証可能な** チェックリスト、 観察可能 / 計測可能 | "Should work properly"、 "App is better" |
| **スコープ外** | 明示的な除外項目 (隣接領域や別 project) | 空欄 (空ならせめて `- なし` と書く) |

### Field 制約

- **Who**: 1-3 文、 最大 200 字。 audience の役割 + 規模感を含める
- **What**: 1-3 文、 必ず動詞 (「できる」「見える」「起動できる」「通知される」等) を含める
- **Why**: 1-3 文、 ビジネス背景 + 時間制約 (期限、 quarter、 依存関係)
- **完了条件**: **必須セクション**、 最低 2 項目、 全項目 `- [ ]` 形式 (checkbox markdown)
- **スコープ外**: 任意セクションだが、 空なら `- なし` を明示する

**List bullet 正規化 (v1.8+)**:
完了条件 / スコープ外 等の list bullet は markdown 的に `-` / `*` どちらも valid。
Linear 側で description を保存すると `-` → `*` (または逆) に正規化されるケースがある
(workspace 設定や client によって差分発生)。

- skill 規約: **両許容**、 parse 時に内部で `-` に正規化してから処理
- write 時の preview / draft は `-` 形式で統一表記
- read 時に `*` が混在していても warning を出さない (false positive 防止)
- 「正規化前 description と正規化後 description の文字列 diff」 を理由に skill が
  rewrite 提案するのは **禁止** (空 diff として扱う)

## AI agent operations

### (A) Read — project を読む

```text
1. URL or ID から mcp__plugin_linear_linear__get_project で取得
2. Description を以下の section に分解:
   ## Who / ## What / ## Why / ## 完了条件 / ## スコープ外
3. PEV context へ変換:
   - Goal ← What (ユーザーアウトカム)
   - Constraints ← スコープ外 + team-conventions.md からの規約
   - Upper-level AC ← 完了条件
   - Context (motivation) ← Why
4. .linear-config.yml の status_mapping を読み、 現在の Linear status を解釈
5. project の子 issue 一覧を mcp__plugin_linear_linear__list_issues
   (`projectId` フィルタ) で取得 — linear-project-tracker への入力
```

Read 時の品質チェック (v1.3.0+ enum 化):

| parse status | 条件 | skill 挙動 |
|---|---|---|
| `FULLY_PARSED` | 5 sections 全揃 + 全 field 制約クリア | 通常 inbound 継続 |
| `PARTIAL_PARSE` | section 1-4 揃うが、 一部 制約違反 (例: Who 曖昧、 完了条件不可検証) | warning + 該当 section を `[LINEAR_INCOMPLETE_<field>]` marker で埋めて inbound 継続 |
| `NO_INPUT` | description が空 / null | hard fail + manual spec collection 提案 |
| `PARSE_ERROR` | 完了条件が `- [ ]` 形式でない、 markdown 破損 | warning + rewrite 提案 (強制せず) + 制限付き inbound 継続 |

`[LINEAR_INCOMPLETE_<field>]` marker は v1.3 で標準化:

- 例: `[LINEAR_INCOMPLETE_WHO]`, `[LINEAR_INCOMPLETE_WHY]`, `[LINEAR_INCOMPLETE_ACCEPTANCE_CRITERIA]`
- 後続 PEV pipeline (planner) が **機械的に検出**して plan.md の Risks に転記
- ユーザー向け表示は `[INCOMPLETE]` で短縮形 (内部記録は full form)

dog food (Phase 1-6 + Phase 4-4) で parse status の暗黙挙動が混乱を生むことが実証されたため、 v1.3 で enum 化。

### (B) Write — 新規 project を作る

```text
1. ユーザー要求から Who / What / Why を identify
   不足なら質問返し (例: "誰のためですか?")
2. Template に従って draft description を構築
3. ★ AI 補完箇所 confirmation table を出力 (v1.8+ 必須)
   ユーザー要求にない情報を AI が推定・補完した箇所を以下 table 形式で
   全て列挙する。 table が空 (= 100% ユーザー入力) でも空 row として明示
4. ★ ユーザーに preview を見せて承認待ち
   (Gate respect — AI 単独で project 作成は禁止、 必ず human-in-the-loop)
   preview には step 3 の table も含める
5. 承認後 mcp__plugin_linear_linear__save_project で create
6. project ID 返却、 次は issue 分解 (linear-issue-workflow に handoff)
```

**AI 補完箇所 confirmation table の形式 (v1.8+ 必須)**:

```markdown
### AI が補完・推定した箇所

| 項目 | 元の自然文 | AI が推定した内容 | 確認したいこと |
|---|---|---|---|
| Who | "全エンジニアが対象" | "Engineering チーム (約 12 名)、 特に backend developer 6 名" | 人数感は合っていますか? 別 audience を含めるべきですか? |
| 完了条件[2] | (なし、 自然文に言及なし) | "deploy 結果が Slack #eng-deploy に通知される" | この通知チャネルで合っていますか? |
| スコープ外[1] | (なし) | "production deploy への適用" | 別 project で扱う想定で OK ですか? |
```

- table が空 (全 field が user 入力からそのまま) でも、 `(なし、 全 field user 入力)`
  を 1 row として記載 (省略不可)
- 列順序固定: `項目 / 元の自然文 / AI が推定した内容 / 確認したいこと`
- 「元の自然文」 column は対応する自然文断片を引用、 該当なしなら `(なし)`
- 「確認したいこと」は ユーザーが Yes/No or 短文で答えられる粒度の質問形式

dog food (Phase 1-2) で skill が自発的にこの table を出した挙動が
非常に valuable だったため、 v1.8 で **必須化**。 ユーザーが AI 推定箇所を
点検できる audit point になる。

Write 時の品質チェック:

- 5 fields 全て埋まっているか
- Field 制約 (文字数、 動詞含有、 checkbox 形式) を満たすか
- AI 補完箇所 table が出力されているか (v1.8+)
- 不適合があれば re-draft (修正版を再 preview)

### (C) Update — project を更新する

```text
1. 完了条件の checkbox 更新:
   - description を編集して `- [ ]` を `- [x]` に変更
   - mcp__plugin_linear_linear__save_project で description 更新
2. 進捗 comment 投稿 (重要: 代替パス必須):
   - Linear MCP の制約: save_comment は issueId 必須 → project 直接コメント不可
   - 代替パス priority:
     (a) 子 issue 経由: project に representative child issue が 1 件以上あれば、
         そこに `mcp__plugin_linear_linear__save_comment` で投稿 (推奨)
     (b) save_status_update 試行: workspace で enabled なら使う
     (c) description embed: 両方不可なら project description 末尾に
         `## Project notes` section を追加して embed
     (d) skip: 全部不可なら warning + skip
3. Status 遷移 (project 完成・stalled 時):
   - .linear-config.yml の status_mapping.project で名前 → state 解決
   - Linear project state は固定 5 種 (`backlog / planned / started / completed / canceled`)
     → issue workflow とは別系統、 yaml で混在しないよう注意
   - `mcp__plugin_linear_linear__save_project` の `state` 引数は name 文字列で OK
     (ID 解決不要、 dog food で実証済み)
   - linear-project-tracker と協調 (重複OK、 ただし sync_state.json で
     「最後の遷移」を記録して二重遷移を避ける)
   - **副作用記録は必須 (v1.8+)**: 遷移直後の `save_project` / `save_issue` response から
     以下 field を読み取り、 変動があれば **必ず** sync_state.json の `side_effects[]`
     に記録する:
     - `started` 遷移: `startedAt` / `startDate` (Linear API が自動セット)
     - `completed` 遷移: `completedAt`
     - `canceled` 遷移: `canceledAt`
     - その他: API response に含まれる timestamps の差分
   - side_effects entry の形式: `{at, transition: "<from>→<to>", field, value, source: "linear-api-response"}`
   - 記録省略は silent corruption (後の同期で diff が説明できなくなる) の原因。
     skill 全体規約として「Status 遷移 = side_effects 記録 1 set」をペアで扱う
4. artifacts/linear/projects/<project_id>/sync_state.json (v1.3 命名規約) に記録:
   - 命名: `artifacts/linear/projects/<project_id>/sync_state.json`
     (issue は `artifacts/linear/issues/<issue_id>/sync_state.json`)
   - schema: `schemas/linear-sync-state.json` を参照 (v1.3 で JSON Schema 固定)
   - 記録項目: last_checkbox_update_at / last_comment_at / last_status_transition_at /
     side_effects[] / error_log[]
```

## Examples

### Good (そのまま AI に流せる)

```markdown
## Project: ステージング即時 deploy ボタン追加

### Who
Engineering チーム (全 12 名)。 特に backend developer 6 名が主要 user

### What
開発者が CI green を待たずに staging deploy を 1 クリックで起動できる

### Why
Q2 リリース予定機能の前提条件。 現在の CI 平均 18 分の待ち時間が
開発体験を悪化させている (PR merge 直後の動作確認が遅れ、 不具合
発見の cycle time が長い)

### 完了条件
- [ ] staging UI に "Deploy now" ボタンが表示される
- [ ] CI 結果に関わらず手動トリガー可能
- [ ] deploy 結果が Slack #eng-deploy に通知される
- [ ] 関連 issue (#101 backend、 #102 frontend、 #103 test) 全 Done

### スコープ外
- production deploy への適用 (別 project)
- rollback UI (v3 で対応予定、 別 project)
```

→ 全 field 制約クリア。 AI が即 PEV context に変換可能。

### Bad (AI が困る anti-pattern)

```markdown
## Project: UX improvement

### Who
Everyone

### What
Make the app better

### Why
Users want it

### 完了条件
- [ ] App is better

### スコープ外
(空欄)
```

問題点:

- Who: 曖昧 ("Everyone" は audience を絞れていない)
- What: 機能列挙以前の抽象 ("Make better" は動詞だが何ができるかが見えない)
- Why: 検証不能 ("Users want it" だけでは判断材料にならない)
- 完了条件: 不可検証 ("App is better" は計測できない)
- スコープ外: 空欄、 `- なし` 明記もない

AI agent の挙動: parse に失敗、 ユーザーに「template に従って書き直すか」を提案。

### Borderline (微妙、 判定基準あり)

```markdown
## Project: Auth middleware の TypeScript 化

### Who
Backend チーム

### What
auth middleware が TypeScript で書かれている

### Why
全 module の TypeScript 化方針 (2025 Q1 決定)

### 完了条件
- [ ] src/auth/middleware.ts が .ts として動く
- [ ] 既存テスト全 PASS

### スコープ外
- 他 module の TypeScript 化
```

判定:

- Who: minimum 通過 (Backend チームでは具体的)
- What: 「ユーザーアウトカム」ではなく「**技術状態**」を書いている。 内部ツール / 開発者向けの場合は許容。 より良くは "Backend エンジニアが TypeScript の型補完を得て middleware を編集できる" のような書き方
- Why: 上位方針への参照、 OK
- 完了条件: 検証可能、 OK
- スコープ外: 明示済み、 OK

AI agent の挙動: parse 成功するが、 What を re-formulate して PEV Goal を「Backend エンジニアの型補完体験」に解釈する。 plan.md に「Project の What は技術状態として書かれているため、 PEV Goal はユーザー視点に翻訳した」とメモを残す。

## Related

- [`linear-issue-workflow`](../linear-issue-workflow/SKILL.md) - project の child issue を起票
- [`linear-project-tracker`](../linear-project-tracker/SKILL.md) - project 進捗監視 (主に status 遷移判定)
- [`pev-linear-sync`](../pev-linear-sync/SKILL.md) - PEV pipeline と Linear Issue の sync
- `.linear-config.yml` - workspace / team.id / status_mapping
- `team-conventions.md` - technical conventions (project Constraints に統合)
- `CLAUDE.md` - .linear-config.yml への pointer

## Notes

- Project の status 遷移は **このskillと linear-project-tracker の両方** が担う。 機能重複だが、 関心の分離 (workflow = active 操作、 tracker = 監視と判定) を維持しつつ、 二重遷移を sync_state.json で防ぐ
- Write (B) の human-in-the-loop は必須 (AI 単独で project 作成しない)。 これは Gate respect の延長で、 Linear への破壊的影響を防ぐため
- Description が template に従っていない既存 project に対しては、 read 時に template-rewrite を提案 (但し強制はしない)
