---
name: pev-linear-sync
description: Linear MCP server 経由で plan.md / verify.json を Linear Issue と双方向 sync。inbound (Linear → spec 抽出)、outbound success (Done + コメント)、outbound fail (failure summary コメント) の3方向。Linear MCP plugin (`@plugin_linear_linear`) が install済みで認証済みであることが前提
---

# pev-linear-sync

Linear Issue を PEV pipeline の入出力として使う skill。 task 起票・追跡・clean-up が Linear 側に閉じる。

## When to Use

- `/pev <linear-issue-url>` の形で起動された時
- 既存 PEV task の `artifacts/linear/issue_id.txt` が存在する時 (outbound sync)
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

## Sync directions

### Direction 1: Inbound (Linear Issue → Plan spec)

`/pev https://linear.app/<workspace>/issue/ENG-123/...` のとき:

1. URL から Linear Issue identifier を抽出 (例: `ENG-123`)
2. `mcp__plugin_linear_linear__get_issue` で Issue 取得
3. Issue の以下フィールドを PEV spec にマッピング:

   | Linear field | PEV spec |
   |---|---|
   | `title` | Goal の seed |
   | `description` | Goal の本文 + Constraints (Linear 規約: `## Constraints` セクションがあれば抽出) |
   | `labels` | Constraints 補強 (例: `breaking-change` ラベル → constraint「破壊的変更につき migration plan を含める」) |
   | `priority` | Estimated task budget の調整 (Urgent: +50%, Low: -30%) |
   | `assignee` | recap.log の actor 表示用 |

4. `artifacts/linear/` ディレクトリを作成:

   ```text
   artifacts/linear/
   ├── issue_id.txt          # 例: ENG-123
   ├── issue_url.txt         # 元 URL
   └── sync_state.json       # inbound_at / last_outbound_at / status
   ```

5. 通常 PEV flow (planner起動) に流す。 planner は spec template を team-conventions.md と組み合わせて plan.md を生成。

### Direction 2: Outbound success (PASS verdict)

verifier が `artifacts/verify.json` を書いて `verdict=PASS` の場合、 `artifacts/linear/issue_id.txt` が存在すれば:

1. Linear Issue にコメント投稿 (`mcp__plugin_linear_linear__save_comment`):

   ```markdown
   ## ✅ PEV completed

   Task ran through pev-harness PEV pipeline.

   - **Plan**: <artifacts/plan.md sha or excerpt>
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

3. `artifacts/linear/sync_state.json` に `last_outbound_at` 記録

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
   - Inspect artifacts/plan.md — is the plan wrong?
   - Run /pev-plan to revise
   - Manual intervention required
   ```

2. Issue status は変更しない (Done にしない)
3. 必要なら `blocked` ラベル追加 (label の存在確認後)
4. `artifacts/linear/sync_state.json` に `escalated_at` 記録

## artifacts/linear/ 規約

```text
artifacts/linear/
├── issue_id.txt        # Linear Issue ID (例: ENG-123)
├── issue_url.txt       # 元 URL
└── sync_state.json
```

`sync_state.json` 構造:

```json
{
  "issue_id": "ENG-123",
  "inbound_at": "2026-05-11T07:23:01Z",
  "last_outbound_at": "2026-05-11T07:26:42Z",
  "outbound_count": 1,
  "current_status": "PASS",
  "escalated_at": null
}
```

`artifacts/` は `.gitignore` 対象、 Linear が source of truth。 ローカル artifacts/linear/ は cache 扱い。

## Linear MCP tool 呼び出し方

Skill 内で agent (planner / verifier 等) が以下のように呼ぶ:

```text
[verifier の outbound success 時]

I will post a completion comment to the Linear issue.

<Tool call>
  name: mcp__plugin_linear_linear__save_comment
  parameters:
    issueId: <from artifacts/linear/issue_id.txt>
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

## Limitations

- **dog food 未実施**: 初版 v1.2.0 では実 Linear workspace での動作確認は author 環境では行わず、 spec のみ提供。 Linear MCP 利用者がフィードバックで詰める。
- **status name は team によって異なる**: "Done" / "Completed" / "Released" のいずれかを優先するが、 マッチしない場合は status 変更を skip。
- **複数 Linear workspace の同時操作は未対応**: 1 task = 1 issue の前提。
- **Linear MCP の認証エラー時の挙動**: skill は warning を出して通常 PEV flow にfallback。 task は完走できる。

## Related

- SPEC.md §9 `artifacts/linear/`
- commands/pev.md (Linear URL 引数検出)
- agents/planner.md (Linear spec 受入)
- agents/verifier.md (outbound sync trigger)
- Issue #8 (v1.1 origination)
