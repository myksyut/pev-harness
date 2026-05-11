# Test Plan: Linear skills (v1.3 candidate)

dog food 用テスト計画。 v1.3 で `linear-project-workflow` を初実装、 既存 v1.2 `pev-linear-sync` も実機検証する。 未実装 skill (`linear-issue-workflow` / `linear-project-tracker` / `pev-linear-sync` 再設計) は **手動で代替** + **観察結果で次の設計を補正**。

## 状況サマリ

| Skill | 状態 | 検証範囲 |
|---|---|---|
| `linear-project-workflow` | v1.3 候補 (新規) | 全機能 (Read/Write/Update/Validation) |
| `pev-linear-sync` | v1.2 release済 | 実機初検証 (これまで spec のみ) |
| `linear-issue-workflow` | 未実装 | 手動代替 |
| `linear-project-tracker` | 未実装 | 手動代替 |
| `pev-linear-sync` 再設計 | 未実装 | 観察結果から検討 |

## Phase 0: 環境準備

- [ ] **0-1** Linear MCP plugin が install済 + 認証済 (`/plugin list` で `@plugin_linear_linear` 表示)
- [ ] **0-2** test 用 Linear team を作成 (既存 team でも OK、 sandbox 推奨)
- [ ] **0-3** `examples/sample-project/.linear-config.yml` を作成 (`.linear-config.yml.example` を参考に値を埋める)
- [ ] **0-4** `examples/sample-project/CLAUDE.md` に Linear config への pointer があることを確認
- [ ] **0-5** `examples/sample-project/team-conventions.md` 既存維持
- [ ] **0-6** `examples/sample-project/` を Linear test team に紐付け (mental binding、 yaml に書く)

## Phase 1: `linear-project-workflow` テスト

### 1-1: Read

```text
セッション内で:
"このプロジェクトを読んでください: https://linear.app/<ws>/project/<test-project-id>"
```

期待:

- [ ] 5 sections (Who/What/Why/完了条件/スコープ外) に分解できた
- [ ] PEV context (Goal/Constraints/Upper-AC/Context) に変換できた
- [ ] `.linear-config.yml` の status_mapping を読んで現 status を解釈した
- [ ] 子 issue 一覧を取得できた

### 1-2: Write (draft 段階)

```text
"次の project を作ってください:
ユーザーが CI 結果を気にせず手動で staging deploy をトリガーできる機能を Q2 までに"
```

期待:

- [ ] template に従って draft description を構築
- [ ] 不足情報があれば質問返し (例: 「audience は誰?」)
- [ ] **★ preview を表示して承認待ちで停止** (この時点では Linear に書かれていない)

### 1-3: Write (承認 → 作成)

```text
ユーザー: "OK、 作成して"
```

期待:

- [ ] `mcp__plugin_linear_linear__save_project` で Linear に project 作成
- [ ] project URL を返却
- [ ] Linear web UI で確認すると description が template 通り

### 1-4: Update (checkbox)

```text
"完了条件の 2 番目を完了にしてください"
```

期待:

- [ ] description 内の `- [ ]` が `- [x]` に変更
- [ ] Linear web UI に反映
- [ ] `artifacts/linear/<project_id>/sync_state.json` に `last_checkbox_update_at` 記録

### 1-5: Update (status 遷移)

```text
"この project を In Progress にしてください"
```

期待:

- [ ] `.linear-config.yml` の `status_mapping.in_progress` で名前 → state ID 解決
- [ ] Linear で status 変更
- [ ] `sync_state.json` に `last_status_transition_at` 記録

### 1-6: Validation (template 違反 project)

```text
template に従わない project を予め作っておく:
"## Who
Everyone

## What
Make it better"

これを skill 経由で read。
```

期待:

- [ ] parse 試行
- [ ] 不足 section / 制約違反を検出
- [ ] **warning 出力**、 「rewrite を提案するが強制しない」挙動

## Phase 2: `pev-linear-sync` (v1.2) テスト

### 2-1: Inbound

```text
/pev-harness:pev https://linear.app/<ws>/issue/<TEAM>-<num>/<slug>
```

期待:

- [ ] URL から identifier 抽出 (`TEAM-num`)
- [ ] `mcp__plugin_linear_linear__get_issue` で取得
- [ ] `artifacts/linear/issue_id.txt` 生成
- [ ] plan.md 冒頭に Linear binding 表記 (`> Linear: [TEAM-num](url)`)

### 2-2: Gate A 停止確認

期待:

- [ ] `permissionMode=default` で Phase 1 完了後に停止
- [ ] artifacts 状態: plan.md / .task_id / .retry_count / recap.log のみ
- [ ] execute.log / verify.json は **生成されていない**

### 2-3: Outbound success

```text
/pev-harness:pev-execute → /pev-harness:pev-verify (PASS)
```

期待:

- [ ] Linear issue に「## ✅ PEV completed」コメント投稿
- [ ] Issue status が Done 相当に遷移
- [ ] `sync_state.json` に `last_outbound_at` 記録

### 2-4: Outbound fail (retry exhausted)

```text
わざと FAIL するタスクで 3 retry exhaust
```

期待:

- [ ] Linear issue に「## ⚠️ PEV escalated」コメント
- [ ] Issue status は **変更されない** (Done にしない)
- [ ] critical_issues 一覧がコメント内に列挙

### 2-5: Fallback (Linear MCP 認証 disable)

期待:

- [ ] warning 出力 (「Linear MCP unavailable」)
- [ ] 通常 PEV flow に fallback、 task 完走できる
- [ ] artifacts/linear/issue_url.txt のみ作成 (issue_id.txt は無し)

## Phase 3: 統合シナリオ (手動代替あり)

| # | 操作 | 代替 |
|---|---|---|
| 3-1 | Project 起票 | Phase 1-2/1-3 を実施 |
| 3-2 | 子 issue 3 件起票 | **Linear UI で手動起票** (linear-issue-workflow 未実装) |
| 3-3 | 各 issue で `/pev <issue-url>` 完走 | Phase 2 を 3 回繰り返し |
| 3-4 | 全 child issue Done を確認 | **手動確認** (linear-project-tracker 未実装) |
| 3-5 | Project status 遷移 (子全完了 → Project Done) | Phase 1-5 を実施 |

期待:

- [ ] 起票 → 実装 → 完了 が end-to-end で動く (手動部分含む)
- [ ] 自然な workflow を感じる箇所 / friction を感じる箇所 を記録 (次の skill 設計の input)

## Phase 4: エッジケース

- [ ] **4-1** `.linear-config.yml` が無い → fallback 動作 (warning + 機能制限で動く)
- [ ] **4-2** `team.id` が Linear と不一致 → エラーメッセージが具体的
- [ ] **4-3** `status_mapping.done = "Released"` だが Linear に "Released" なし → default ("Done"/"Completed") 試行
- [ ] **4-4** description parse 不能 (空 project、 yaml 風) → graceful failure
- [ ] **4-5** Linear permission 不足 (read-only token で write) → 適切なエラー

## Phase 5: 観察項目 (定量 + 定性)

### 定量

- [ ] 各 skill の token consumption (推定、 各 phase で)
- [ ] 実行時間 (Linear API latency 含む)
- [ ] human-in-the-loop の介入回数 (Phase 1 Write で 1 回が期待値)
- [ ] retry/escalation の頻度

### 定性

- [ ] workflow が **自然** か (project → issue → PEV → outbound → project の循環)
- [ ] **friction を感じる箇所** (例: 「ここで承認待ちは要らない」「この警告は noise」)
- [ ] agent の判断ミス (例: borderline project を bad と誤判定)
- [ ] **未実装 skill が必要な瞬間** (次の設計優先順位の input)

## Feedback collection template

dog food 完了後、 以下のフォーマットで GitHub Issue を立てる:

```markdown
## Test session: <date>

### Environment
- Linear workspace: <ws>
- Test team: <team>
- Tested skills: linear-project-workflow / pev-linear-sync
- Other skills: handled manually

### Phase results
- Phase 0: ✅/❌ (notes...)
- Phase 1-1: ✅/❌
- Phase 1-2: ...
- ...

### Friction points
1. ...
2. ...
3. ...

### Suggestions for next skills
- linear-issue-workflow: ...
- linear-project-tracker: ...
- pev-linear-sync re-design: ...

### Quantitative observations
- token estimate: ...
- avg response time: ...
- human-in-the-loop count: ...
```

## After dog food

ユーザー方針に従って **B 案 (dog food 後に 1 commit で完結)** で進める:

1. dog food 実施 (このテスト計画に沿って)
2. 結果フィードバックを Issue として起票
3. フィードバックに基づき linear-project-workflow / pev-linear-sync 修正
4. 1 commit にまとめて v1.3.0 として release

## Related

- [`skills/linear-project-workflow/SKILL.md`](../skills/linear-project-workflow/SKILL.md)
- [`skills/pev-linear-sync/SKILL.md`](../skills/pev-linear-sync/SKILL.md)
- [`examples/linear-task-flow.md`](../examples/linear-task-flow.md)
