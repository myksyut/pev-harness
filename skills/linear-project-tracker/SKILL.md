---
name: linear-project-tracker
description: Linear Project の進捗監視と完了判定。 child issue 群の状態を読み取り、 全 Done なら project status を completed 候補と判定する。 linear-project-workflow とは責務分離 (workflow = active 操作、 tracker = 監視と判定)。 pev-linear-sync の outbound success 後の after-hook として呼ばれることが多い。
---

# linear-project-tracker

Linear Project の **child issue 群の進捗を監視し、 project 完了候補を判定** する skill。 `linear-project-workflow` と機能重複しないよう責務を分離:

- `linear-project-workflow`: project description の作成・更新、 status 遷移の **実行**
- `linear-project-tracker`: child issue 群を **読み取り**、 project 完了判定 + 遷移**提案**

実際の status 遷移は `linear-project-workflow` の Update (C) を呼んで実施 (重複防止)。

## When to Use

起動すべき場面:

- `pev-linear-sync` outbound success の after-hook (issue が Done になった後の parent project 進捗確認)
- 定期チェック (cron-like、 1 project の進捗を確認)
- ユーザーが「project X は完了したか」と問うた時

起動すべきでない場面:

- project description の作成・更新 → `linear-project-workflow`
- 単一 issue の sync → `pev-linear-sync`
- issue の起票・更新 → `linear-issue-workflow` (未実装、 v1.4 候補)

## Preflight check (v1.3.0+ 必須)

`linear-project-workflow` と **共通の preflight** を実行:

1. `.linear-config.yml` 存在確認
2. team.id 整合性検査
3. status workflow preflight (`list_issue_statuses` で完了条件 status を解決)

詳細は `skills/linear-project-workflow/SKILL.md` の Preflight 節を参照 (single source of truth)。

## MCP error handling (v1.3.0+ 必須)

`linear-project-workflow` と **同じ error 分類表** を使う。 詳細は同 SKILL.md 参照。

## How It Works

### Operation 1: Child issue 進捗確認

```text
1. project_id を input として受け取る
2. mcp__plugin_linear_linear__list_issues(project=project_id) で子 issue 一覧取得
3. 各 issue の status (Linear API の statusType) を分類:
   - completed (Done / Released 等): 完了
   - canceled (Canceled / Duplicate 等): 取消
   - unstarted / backlog: 未着手
   - started: 進行中
4. 集計: total / completed_count / canceled_count / in_progress_count / unstarted_count
```

### Operation 2: Project 完了判定

```text
判定ルール:
  - all_done: completed_count + canceled_count == total かつ completed_count > 0
  - mostly_done: completed_count / total >= 0.8
  - in_progress: in_progress_count > 0 or completed_count > 0
  - not_started: unstarted_count == total

判定結果:
  - all_done → project status を `completed` に遷移 候補
  - mostly_done → warning + 残 issue 一覧を report
  - in_progress → 現状維持、 進捗 comment 投稿 候補
  - not_started → 何もしない (project 自体が未着手)
```

### Operation 3: Project 完了条件 (description AC) との突き合わせ

project description の `## 完了条件` セクションを `linear-project-workflow` Read で parse:

- 完了条件の各 `- [ ]` / `- [x]` 項目を取得
- child issue Done 比率と完了条件 check 比率を比較
- 不整合がある場合は warning (例: 「child 全 Done だが完了条件 3/5 のみ check」)

これは project description の checkbox を手動更新せず、 child issue 完了で自動推進したいケースに使う。

### Operation 4: Status 遷移**提案** (実行は workflow に委譲)

```text
判定が `all_done` の場合:
  1. linear-project-tracker は遷移を提案 (sync_state.json に proposal を書く)
  2. linear-project-workflow の Update (C) が呼ばれて実際の遷移を実行
     - .linear-config.yml の status_mapping.project.completed を参照
     - mcp__plugin_linear_linear__save_project(id, state='completed')
  3. 重複防止: .pev-artifacts/linear/projects/<project_id>/sync_state.json の
     last_status_transition_at をチェック、 直近 24h 以内なら skip
```

tracker が直接 status 遷移を実行することも spec 上は可能だが、 v1.3 では **workflow に委譲する形を推奨** (関心の分離維持)。

## artifacts への記録 (v1.3.0+ 命名規約)

```text
.pev-artifacts/linear/projects/<project_id>/
└── sync_state.json
    {
      "tracker_runs": [
        {
          "at": "...",
          "snapshot": {"total": N, "completed": N, "in_progress": N, ...},
          "judgment": "all_done | mostly_done | in_progress | not_started",
          "proposal": "transition_to_completed | warning | none"
        }
      ],
      "last_tracker_run_at": "..."
    }
```

JSON Schema は `schemas/linear-sync-state.json` に従う。

## When to use vs linear-project-workflow

| 操作 | tracker | workflow |
|---|---|---|
| child issue 一覧取得 | ✅ 主責任 | (利用は可) |
| 完了判定 | ✅ 主責任 | (read 時に補助) |
| status 遷移**提案** | ✅ 主責任 | (受け取って実行) |
| status 遷移**実行** | (委譲) | ✅ 主責任 |
| description 編集 | ❌ | ✅ 主責任 |
| comment 投稿 | (proposal noteのみ) | ✅ 主責任 |

## Examples

### Outbound success after-hook (典型シナリオ)

```text
[pev-linear-sync outbound success が完了直後]

1. tracker が起動 (parent project_id をinput)
2. child issue 一覧取得: 3 issues, 全 Done
3. judgment: all_done
4. proposal: transition_to_completed
5. linear-project-workflow Update (C) を呼んで実際の遷移を実行
6. project が completed status に遷移、 startedAt → completedAt 自動セット
```

### 部分完了の警告 (mostly_done)

```text
child issue 5 件中 4 件 Done、 1 件 In Progress

judgment: mostly_done (80%)
proposal: warning + 残 issue 一覧 ("TES-7 残りで project 完了")
status 遷移: 実行しない (1 件 In Progress のため)
```

## Limitations

- **child issue が 0 件の project** は判定不能 (`linear-project-workflow` で description の 完了条件 checkbox に依存)
- **canceled issue の扱い** は workspace ポリシー依存 (default では「完了扱い」だが、 yaml で `canceled_as_done: false` で override 可、 v1.4 候補)
- **24h 以内の重複遷移防止** は heuristic、 厳密な lock 機構ではない

## Related

- [`linear-project-workflow`](../linear-project-workflow/SKILL.md) — status 遷移の実行を委譲
- [`pev-linear-sync`](../pev-linear-sync/SKILL.md) — outbound success 後の after-hook trigger
- `linear-issue-workflow` (未実装、 v1.4 候補) — child issue の起票・更新

## Notes

dog food (Phase 3) で linear-project-tracker の必要性が確認された (child 1/1 = 100% Done を手動で判定したが、 通常運用では自動化必須)。 v1.3 で skill 仕様を策定、 実装挙動は v1.4 の dog food で詰める想定。
