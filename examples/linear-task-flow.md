# Linear Task Flow (v1.2+)

`pev-linear-sync` skill を使った Linear Issue 連携の使い方例。

## 前提

- Linear MCP plugin (`@plugin_linear_linear`) install + 認証済み
- Linear workspace に test Issue (例: `ENG-123`) を作成済み
- Issue title: "Add /healthz endpoint to src/server.ts"
- Issue description: `Acceptance: GET /healthz returns 200 + {status: "ok"}, test added.`

## Flow 1: Happy path (Linear → Plan → Execute → Verify → Linear)

```bash
# 1. Linear Issue URL を /pev に渡す
claude
> /pev-harness:pev https://linear.app/myorg/issue/ENG-123/add-healthz-endpoint
```

期待される動作:

1. `pev-linear-sync` (inbound) が起動
2. Linear Issue ENG-123 を `mcp__plugin_linear_linear__get_issue` で取得
3. `artifacts/linear/issue_id.txt` = `ENG-123`
4. `artifacts/linear/sync_state.json` 作成 (inbound_at 記録)
5. planner: plan.md 生成 (冒頭に Linear binding 表記)
6. Gate A (permissionMode=default なら停止、 ユーザーが `/pev-execute` で続行)
7. executor: コード変更
8. verifier: 検証 → verdict=PASS
9. `pev-linear-sync` (outbound success):
   - Linear Issue にコメント投稿: `## ✅ PEV completed` + 詳細
   - Issue status → "Done" (team の workflow 名による)
   - `sync_state.json` last_outbound_at 記録
10. recap.log 最終エントリ

## Flow 2: Escalation (retry 上限)

```bash
> /pev-harness:pev https://linear.app/myorg/issue/ENG-456/refactor-auth --strict
```

期待される動作:

1. inbound → plan → execute → verify (--strict, dual-review)
2. verdict=FAIL → planner retry (round 1)
3. retry → fail → retry (round 2) → fail → retry (round 3) → fail
4. retry_count = 3 = PEV_MAX_RETRIES に到達
5. `pev-linear-sync` (outbound fail):
   - Linear Issue にコメント: `## ⚠️ PEV escalated` + critical_issues 一覧
   - Issue status は **変更しない** (Done にしない)
   - "blocked" ラベル付与 (label が存在すれば)

## Flow 3: Linear MCP unavailable

```bash
> /pev-harness:pev https://linear.app/myorg/issue/ENG-789/some-task
```

Linear MCP plugin がない or 認証 expired の場合:

```text
[PEV] WARNING: pev-linear-sync skill found Linear URL but Linear MCP is unavailable.
[PEV] Falling back to manual spec extraction from URL.
[PEV] Issue URL stored in artifacts/linear/issue_url.txt for reference.
```

通常 PEV flow に fallback。 task は完走できる。 完走後の Linear sync は skip。

## Flow 4: 既存 task に Linear binding を後付け

```bash
# 既存の task (artifacts/.task_id がある状態) に Linear binding を追加
> /pev-harness:pev-linear-sync bind ENG-999
```

(v1.2 では未実装、 v1.3 候補。 現状は `/pev <url>` で新規 task として起動するのが推奨。)

## 注意点

- **artifacts/linear/ は gitignore 対象**: Linear が source of truth、 ローカルは cache
- **Linear MCP の API 名は version によって変わる可能性**: skill は仕様で書き、 実機エラー時は MCP server の docs を確認
- **status name は team によって異なる**: pev-linear-sync は "Done" / "Completed" / "Released" のいずれかを優先するが、 マッチしない場合は status 変更を skip
- **plan.md と Linear Issue 内容が乖離した場合**: plan.md が真実 (planner が team-conventions と統合して決定したもの)、 Linear Issue は元 spec

## Troubleshooting

| 症状 | 原因 | 対処 |
|---|---|---|
| "Linear MCP not found" | plugin install / 認証なし | `@plugin_linear_linear` の install / OAuth |
| Issue ID 抽出失敗 | URL format が想定外 | 標準形 `linear.app/<ws>/issue/<TEAM-NUM>` で再試行 |
| status 変更されない | Done 相当の name が team に存在しない | v1.3 fallback chain (`Done → Completed → Released`) を試行、 全失敗なら skip |
| 同じ Issue に複数 PEV task が走った | binding cleanup なし | 完了後 `/pev-status --clean` で artifacts/linear/ も削除 |
| Preflight error: "team.id mismatch" | `.linear-config.yml` の `team.id` が Linear team key と不一致 | yaml 値を Linear UI で確認、 修正 |
| Preflight error: "config not found" + Write 操作 | `.linear-config.yml` 不在で Write 系操作 | `.linear-config.yml.example` を copy して値を埋める |
| 404 / "Entity not found" | URL 内 issue が存在しない or archived | fallback で manual spec collection、 issue URL を確認 |
| GraphQL "Project status updates not enabled" | workspace 設定で status update disabled | `description embed` 代替パスが自動発動、 もしくは `linear-project-workflow` Update (C) の代替パス参照 |

## v1.3+ edge cases (dog food で確認済)

### `.linear-config.yml` 不在シナリオ

- Read 系操作: warning + degraded fallback (workspace 不在で機能制限あるが動く)
- Write 系操作: hard fail (silent corruption リスク防止)
- 対処: `cp .linear-config.yml.example .linear-config.yml` + 値を埋める

### team.id 不一致シナリオ

Preflight check (v1.3) で hard fail。 yaml 値が Linear team の `key` (例: `TES`) と一致するか確認。

### status_mapping にない status name

skill が `status_mapping.issue.done` を name として `list_issue_statuses` から ID 解決を試みる。 fallback chain (`Done → Completed → Released`) を順試行、 全失敗なら status 変更 skip + warning。

### parse 不能な project description

`linear-project-workflow` Read で parse status `NO_INPUT` (空) / `PARSE_ERROR` (markdown 破損) を判定。 `PARTIAL_PARSE` の場合は `[LINEAR_INCOMPLETE_<field>]` marker を付けて inbound 継続。

### MCP permission denied (write 不可 token)

Preflight permission probe で検出 (v1.3)、 hard fail + preview-only mode 提案。 token scope を見直す。
