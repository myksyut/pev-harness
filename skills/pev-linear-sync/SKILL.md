---
name: pev-linear-sync
description: Linear MCP server 経由で plan.md / verify.json を Linear Issue と双方向 sync。inbound (Linear → spec 抽出)、issue-first (実装前に issue 作成 + branch checkout、v3.3.0+)、outbound success (Done + コメント)、outbound fail (failure summary コメント) の4方向。Linear MCP plugin (`@plugin_linear_linear`) が install済みで認証済みであることが前提
---

# pev-linear-sync

Linear Issue を PEV pipeline の入出力として使う skill。 task 起票・追跡・clean-up が Linear 側に閉じる。

## When to Use

- `/pev <linear-issue-url>` の形で起動された時 (= inbound)
- **`.linear-config.yml` が存在し、 自然文 task で `/pev` が起動された時** (= issue-first、 v3.3.0+)
- 既存 PEV task の `.pev-artifacts/linear/issue_id.txt` が存在する時 (outbound sync)
- ユーザーが明示的に `/pev-linear-sync inbound <url>` を呼んだ時

## Prerequisites

- Linear MCP plugin が install済み: `@plugin_linear_linear` (Anthropic 公式)
- Linear 認証完了 (Linear API token または OAuth)
- Linear MCP tools が available:
  - `mcp__plugin_linear_linear__get_issue`
  - `mcp__plugin_linear_linear__save_comment`
  - `mcp__plugin_linear_linear__save_issue`
  - `mcp__plugin_linear_linear__list_issue_statuses` (status 名解決用)

不在時の挙動: skill は warning を出して通常 PEV flow にfallback (Linear連携をスキップ)。

## MCP warmup (v1.3.0+ 必須)

Linear MCP tool は deferred (initial load 時に schema 解決が必要)。 skill 起動直後に以下を実行:

```text
1. ToolSearch で linear MCP tools 必須セットを load:
   - mcp__plugin_linear_linear__get_issue
   - mcp__plugin_linear_linear__get_project
   - mcp__plugin_linear_linear__save_comment
   - mcp__plugin_linear_linear__save_issue
   - mcp__plugin_linear_linear__list_issue_statuses
2. load 失敗時は warning + fallback to pev-spec-template (Linear 連携 skip)
```

## MCP error handling (v1.3.0+ 必須)

`linear-project-workflow` skill と **同じ error table** を共有。 ad-hoc error handling 禁止:

| Error type | Skill 挙動 | Retry budget |
|---|---|---|
| `404 / Entity not found` | warning + fallback (issue_id.txt 作らず、 sync_state に `inbound_status: failed`) | 0 |
| `PERMISSION_DENIED` | hard fail + preview-only mode 提案 | 0 |
| `NETWORK / TIMEOUT` | exp backoff retry | 3 |
| `GRAPHQL_ERROR` | error 種別 lookup → 該当 row | 0 |
| `VALIDATION` | warning + status_mapping fallback chain | 0 |
| `RATE_LIMIT` | exp backoff + retry | 3 |

詳細は `skills/linear-project-workflow/SKILL.md` の MCP error handling 表を参照 (single source of truth)。

### Fallback marker 仕様 (v1.3.0+)

inbound 失敗時 (404 / network / validation 等) の合図:

- `.pev-artifacts/linear/issues/<issue_id>/sync_state.json` を **作る** (新命名規約、 後述)
  - 中身: `inbound_status: "failed"`, `error_log[0]`, `fallback_invoked: true`
- `.pev-artifacts/linear/issue_id.txt` は **作らない** (presence が成功の合図)
- `.pev-artifacts/linear/issue_url.txt` は元 URL を保持 (debug 用)

### Warning メッセージ template (v1.3.0+ 標準)

固定文言で recap.log / agent 出力に書く:

```text
[PEV] WARNING: Linear issue <ID> not found, falling back to manual spec extraction
[PEV] WARNING: Linear MCP permission denied for <action>, switching to preview-only mode
[PEV] WARNING: Linear MCP unavailable, operating in degraded mode
```

### Fallback 後の handoff (v1.3.0+ 規約)

責務分担を明確化:

- skill (`pev-linear-sync`) は fallback 状態を `sync_state.json` に書いて **return**
- `/pev` コマンド側が `sync_state.inbound_status` を読み:
  - `inbound_status: "failed"` なら `pev-spec-template` を起動 (manual spec collection に切替)
  - `inbound_status: "ok"` なら通常 inbound flow を継続

## Sync directions

### Direction 1: Inbound (Linear Issue → Plan spec)

`/pev https://linear.app/<workspace>/issue/ENG-123/...` のとき:

1. URL から Linear Issue identifier を抽出 (例: `ENG-123`)
2. `mcp__plugin_linear_linear__get_issue` で Issue 取得
3. **(v1.3+) parent project context 取り込み**: response の `projectId` が non-null なら
   `mcp__plugin_linear_linear__get_project(query=projectId)` で parent project を取得 →
   project の Why/What を planner に inject (Upper-AC として活用、 Phase 3 dog food で実証)
4. Issue の以下フィールドを PEV spec にマッピング:

   | Linear field | PEV spec |
   |---|---|
   | `title` | Goal の seed |
   | `description` | Goal の本文 + Constraints (Linear 規約: `## Constraints` セクションがあれば抽出) |
   | `labels` | Constraints 補強 (例: `breaking-change` ラベル → constraint「破壊的変更につき migration plan を含める」) |
   | `priority` | Estimated task budget の調整 (Urgent: +50%, Low: -30%) |
   | `assignee` | recap.log の actor 表示用 |

5. `.pev-artifacts/linear/` ディレクトリを作成:

   ```text
   .pev-artifacts/linear/
   ├── issue_id.txt          # 例: ENG-123
   ├── issue_url.txt         # 元 URL
   └── sync_state.json       # inbound_at / last_outbound_at / status
   ```

6. 通常 PEV flow (planner起動) に流す。 planner は spec template を team-conventions.md と組み合わせて plan.md を生成。

### Direction 1.5: Issue-first (実装前 issue 作成 + branch checkout、 v3.3.0+)

`.linear-config.yml` が cwd に存在し、 **自然文 task で `/pev` が起動された** (= Linear URL ではない) 場合、 commands/pev.md の Gate L (Step 2.5、 = Gate A の前、 v3.3.1+) から呼ばれる。 「実装前に必ず Linear issue を立てて、 Linear が発行する branch 名で実装する」 を強制する direction。

**前提条件**:

- `.linear-config.yml` が cwd に存在 (= 不在なら この direction は skip、 従来 flow)
- `.pev-artifacts/linear/issue_id.txt` が **未作成** (= inbound case ではない、 = まだ issue がない)
- task は自然文 (= Linear URL 直指定ではない)

**手順**:

1. `.linear-config.yml` から `workspace` / `team.id` を読む
2. **`linear-issue-workflow` skill の template + 命名規則に従って issue body と title を組み立てる** (v3.4.0+):
   - title 命名規則: **具体的な作業内容を動詞で表現** (= How、 詳細は `linear-issue-workflow` SKILL.md 参照)
   - description は 6 section template (概要 / 背景・現状 / やること / やらないこと / 完了条件 / 参考情報)
   - 入力源:
     - `.pev-artifacts/plan.md` が存在する (= plan_required path だった) → Goal を 概要、 Constraints/Risks を 背景・現状、 File-level changes を やること、 scope 外を やらないこと、 AC を 完了条件 にマッピング
     - plan.md がない (= plan_skip / Mode B path) → task description を 概要、 `.pev-artifacts/triage.json` の reasoning / context_signals を 背景・現状、 推定実装 step を やること、 AC を task description から導出
3. `mcp__plugin_linear_linear__save_issue` で **新規 issue を作成**:
   - `teamId`: `.linear-config.yml` の `team.id` から解決
   - `title`: 上記 命名規則の動詞句
   - `description`: 上記 6 section template
   - `stateId`: team workflow の "In Progress" 系 (= `list_issue_statuses` で解決、 fallback chain `In Progress → Started → Todo`)
4. 作成された issue の **branch 名を取得**:
   - **`save_issue` の戻り値に `gitBranchName` field が含まれる** (= harness-effect-v17 で実機確認)。 別途 `get_issue` での再取得は **不要**
   - `gitBranchName` の例: `shotamiyaki/tes-1-pev-dog-food-v17-...` (= Linear が自動生成、 `<assignee-handle>/<issue-id>-<slug>` 形式)
   - 万一 `save_issue` 戻り値に `gitBranchName` が無い場合のみ `mcp__plugin_linear_linear__get_issue` で再取得 (= get_issue は「including ... git branch name」 と返す)
5. `git checkout -b <branchName>` で branch を切る:
   - branch が既に存在する場合 (= 再実行) は `git checkout <branchName>` で switch
   - git 管理外の cwd なら warning を出して branch checkout は skip (issue 作成のみ)
6. `.pev-artifacts/linear/` を作成:

   ```text
   .pev-artifacts/linear/
   ├── issue_id.txt          # 作成された issue ID (例: TES-123)
   ├── issue_url.txt         # issue URL
   ├── branch_name.txt       # Linear 発行の branch 名 (v3.3.0+)
   └── sync_state.json       # created_at / branch_checked_out / status
   ```

7. commands/pev.md に return、 Execute へ進む (= 以降の実装は Linear branch 上で走る)

**outbound sync との連携**: 後続の Direction 2 (outbound success) / Direction 3 (outbound fail) は、 issue-first で作成した issue に対しても同様に動く (= `.pev-artifacts/linear/issue_id.txt` を読む共通 path)。

**冪等性**: `.pev-artifacts/linear/issue_id.txt` が既に存在する場合は issue を再作成せず、 既存 issue の branch に checkout するだけ。

**degraded mode 条件 (v3.3.3+ で refine、 F_v17_2)**: 以下のいずれも「Linear MCP が使えない」 とみなし、 **degraded mode** (= warning + issue 作成 / branch checkout を skip、 pipeline は止めない) に倒す:

- Linear MCP plugin が install されていない (= 完全 unavailable)
- Linear MCP plugin はあるが **OAuth 未認証 / token expired** (= configured but unauthed)
- **headless (`-p`) mode で起動されており、 OAuth フローを完了できない**

特に重要: **headless mode で Linear MCP が未認証の場合、 OAuth 認証 URL を出して停止するのは禁止**。 headless subprocess (= dog food / CI 自動化) はブラウザ OAuth を完了できないため、 OAuth を試みると pipeline がブロックする (harness-effect-v17 / F_v17_1 で観測)。 この場合は degraded mode に倒して「Linear 連携は skip、 通常 flow で続行」 と warning を出す。

interactive session で Linear MCP が未認証の場合のみ、 user に `/mcp` での再認証を案内してよい (= この場合は user が OAuth を完了できる)。

### Direction 2: Outbound success (PASS verdict)

verifier が `.pev-artifacts/verify.json` を書いて `verdict=PASS` の場合、 `.pev-artifacts/linear/issue_id.txt` が存在すれば:

1. Linear Issue にコメント投稿 (`mcp__plugin_linear_linear__save_comment`):

   ```markdown
   ## ✅ PEV completed

   Task ran through pev-harness PEV pipeline.

   - **Plan**: <.pev-artifacts/plan.md sha or excerpt>
   - **Files changed**: <count, summary>
   - **Acceptance criteria**: all met (<count>/<count>)
   - **Retries**: <N>
   - **Verifier checks**: all passed (build / typecheck / lint / tests)

   ### Notes from verifier
   <verify.json.notes if any>
   ```

2. Issue status を `Done` 系に遷移 (`mcp__plugin_linear_linear__save_issue`):
   - team の workflow status を `list_issue_statuses` で取得
   - "Done" / "Completed" / "Released" のような名前のものを優先 (team ごとに異なる)
   - 不明なら現状維持してコメントのみ

3. `.pev-artifacts/linear/sync_state.json` に `last_outbound_at` 記録

### Direction 3: Outbound fail (FAIL verdict、 retry 上限到達)

verify.json が `verdict=FAIL` かつ `retry_count >= PEV_MAX_RETRIES` の時:

1. Linear Issue にコメント投稿:

   ```markdown
   ## ⚠️ PEV escalated

   Task could not be completed automatically after <N> retries.

   ### Critical issues remaining
   - <verify.json.critical_issues[0]>
   - <verify.json.critical_issues[1]>
   ...

   ### Suggestions
   - Inspect .pev-artifacts/plan.md — is the plan wrong?
   - Run /pev-plan to revise
   - Manual intervention required
   ```

2. Issue status は変更しない (Done にしない)
3. 必要なら `blocked` ラベル追加 (label の存在確認後)
4. `.pev-artifacts/linear/sync_state.json` に `escalated_at` 記録

## .pev-artifacts/linear/ 規約

```text
.pev-artifacts/linear/
├── issue_id.txt        # Linear Issue ID (例: ENG-123)
├── issue_url.txt       # 元 URL
├── branch_name.txt     # Linear 発行の branch 名 (issue-first 時のみ、 v3.3.0+)
└── sync_state.json
```

`sync_state.json` 構造:

```json
{
  "issue_id": "ENG-123",
  "inbound_at": "2026-05-11T07:23:01Z",
  "created_at": null,
  "branch_name": null,
  "branch_checked_out": false,
  "last_outbound_at": "2026-05-11T07:26:42Z",
  "outbound_count": 1,
  "current_status": "PASS",
  "escalated_at": null
}
```

- `inbound_at`: inbound direction (Linear URL → spec) で set
- `created_at` / `branch_name` / `branch_checked_out`: issue-first direction (v3.3.0+) で set
- inbound と issue-first は排他 (= 1 task は どちらか一方の経路)

`.pev-artifacts/` は `.gitignore` 対象、 Linear が source of truth。 ローカル .pev-artifacts/linear/ は cache 扱い。

## Linear MCP tool 呼び出し方

Skill 内で agent (planner / verifier 等) が以下のように呼ぶ:

```text
[verifier の outbound success 時]

I will post a completion comment to the Linear issue.

<Tool call>
  name: mcp__plugin_linear_linear__save_comment
  parameters:
    issueId: <from .pev-artifacts/linear/issue_id.txt>
    body: |
      ## ✅ PEV completed
      ...

<Tool call>
  name: mcp__plugin_linear_linear__save_issue
  parameters:
    id: <same issue id>
    stateId: <Done state id, looked up via list_issue_statuses>
```

Linear MCP の paramater 名は MCP server の version によって変わる可能性。 skill は名前指定で書き、 実機で動作確認時に調整。

## Examples

### Inbound + flow 完走 (happy path)

```text
/pev https://linear.app/myorg/issue/ENG-123/add-healthz-endpoint
```

1. pev-linear-sync inbound: Linear Issue ENG-123 取得、 plan spec 構築
2. planner: plan.md 生成 (Linear Issue の description → Goal/Constraints/AC に展開)
3. Gate A: permissionMode判定
4. executor: コード変更
5. verifier: 全 check PASS → verdict=PASS
6. pev-linear-sync outbound success:
   - Linear に `## ✅ PEV completed` コメント投稿
   - Issue status → Done
   - sync_state.json 更新
7. recap.log: 最終エントリ

### Inbound → retry → escalate

```text
/pev https://linear.app/myorg/issue/ENG-456/refactor-auth --strict
```

1. inbound → plan → execute → verify (FAIL)
2. retry 3 回しても FAIL
3. pev-linear-sync outbound fail:
   - Linear に `## ⚠️ PEV escalated` コメント
   - critical_issues 一覧、 manual intervention 案内
   - Issue status は **変更しない** (Done にしない)

## URL parsing

Linear Issue URL の形:

```text
https://linear.app/<workspace>/issue/<TEAM-NUMBER>/<slug>
https://linear.app/<workspace>/issue/<TEAM-NUMBER>            # slug なし
linear.app/<workspace>/issue/<TEAM-NUMBER>                    # protocol 省略
```

抽出する identifier: `<TEAM-NUMBER>` (例: ENG-123)。 正規表現:

```regex
linear\.app/[^/]+/issue/([A-Z]+-\d+)
```

不正な URL なら error 表示、 通常 PEV flow にfallback。

## Responsibility separation (v1.3.0+)

skill と呼び出し側 (`/pev` command / parent agent) の責務を明文化:

| 操作 | 担当 |
|---|---|
| Linear MCP tool 呼び出し (get_issue / save_comment / save_issue 等) | **skill** (pev-linear-sync) |
| 引数 parse (URL → identifier) | **skill** |
| sync_state.json への write | **skill** |
| Fallback marker の設定 | **skill** |
| `pev-spec-template` skill の **起動** | **`/pev` command** (skill は inbound_status を書いて return、 起動判断は呼び出し側) |
| `planner` / `executor` / `verifier` agent の **起動** | **`/pev` command + 各 phase command** (skill は agent を spawn しない) |
| Linear MCP tool の **warmup** (ToolSearch) | **`/pev` command** が skill 起動前に実施 |
| issue-first の **trigger 判定** (`.linear-config.yml` 存在 + 自然文 task + issue 未作成) | **`/pev` command** の Gate L (Step 3.5)。 skill は呼ばれたら issue 作成 + branch checkout を実行 |
| `git checkout` の実行 | **skill** (pev-linear-sync issue-first direction)。 ただし git 管理外なら warning + skip |

dog food (Phase 2-3) で確認された原則: **skill は state を artifacts に書いて return する。 agent spawn 等の制御フローは呼び出し側 (`/pev` command 系) が担う**。 これは関心の分離を維持して skill の reusability を高める。

## Limitations

- **dog food 実施済 (v1.3.0)**: 28 件の finding を spec に反映済み (`guide/dogfood-v1.3-report.md` 参照)。 引き続き利用者フィードバックで改善継続。
- **status name は team によって異なる**: v1.3 で `.linear-config.yml` `status_mapping.issue` で明示、 fallback chain (`Done → Completed → Released`) を試行。
- **複数 Linear workspace の同時操作は未対応**: 1 task = 1 issue の前提。
- **Linear MCP の認証エラー時の挙動**: 「MCP error handling」表の `PERMISSION_DENIED` row に従う (hard fail + preview-only mode 提案)。 詳細は `linear-project-workflow` の同名 section を参照。

## Related

- `skills/linear-issue-workflow/SKILL.md` (= issue 命名規則 / template 6 section、 v3.4.0+)
- `skills/linear-project-workflow/SKILL.md` (= project 命名規則 / template 5 section)
- `skills/linear-project-tracker/SKILL.md` (= project 進捗監視)
- SPEC.md §9 `.pev-artifacts/linear/`
- commands/pev.md (Linear URL 引数検出 + Gate L)
- agents/planner.md (Linear spec 受入)
- agents/verifier.md (outbound sync trigger)
- Issue #8 (v1.1 origination)
