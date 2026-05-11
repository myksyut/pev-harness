---
description: Run full Plan-Execute-Verify pipeline for a coding task
---

# /pev

PEV harnessのメインコマンド。Plan → Execute → Verify を順に実行する。

## Usage

```
/pev <task description>
/pev <task> --strict       # dual review有効化
/pev <task> --parallel     # 独立ファイル変更を並列実行
/pev <linear-issue-url>    # (v1.x) Linear Issueから自動展開
```

## 実行手順

1. `pev-spec-template` skillを起動し、入力からGoal/Constraints/AC を抽出
2. 不足要素があれば質問返ししてユーザーに補完してもらう
3. task_id 発行:
   ```bash
   mkdir -p artifacts
   TASK_ID="$(date +%s)-$(openssl rand -hex 4 2>/dev/null || echo $RANDOM)"
   echo "$TASK_ID" > artifacts/.task_id
   mkdir -p ~/.claude/pev/$TASK_ID
   ```
4. **Phase 1 (Plan)**: planner agent を起動
   - 入力: 整形済みspec + team-conventions.md (あれば)
   - 出力: `artifacts/plan.md`
5. **Gate A**: `permissionMode` を判定
   - `auto`: そのまま Phase 2 へ
   - `default`: `cat artifacts/plan.md` を表示して停止。`/pev-execute` で続行を促す
   - `plan`: ここで終了
6. **Phase 2 (Execute)**: executor agent を起動
   - `--parallel` 指定時、独立ファイルを最大3並列で
   - 出力: コード変更 + `artifacts/execute.log`
7. **Gate B**: Stop hookが自動でPhase 3起動
8. **Phase 3 (Verify)**: verifier agent
   - `--strict` 指定時、pev-dual-review が起動
   - 出力: `artifacts/verify.json`
9. **Retry Gate**: verify.json `verdict`:
   - PASS → 完了、pev-recap を起動
   - FAIL & retry<3 → Phase 1 に戻る
   - FAIL & retry>=3 → escalate

## 完了時の出力

```
[PEV done]
Task: <task_id>
Phases: 1, 2, 3
Result: PASS
Files changed: N
Recap: artifacts/recap.log

Next steps:
- Review changes with `git diff`
- Run `/pev-status --clean` to clear artifacts after commit
```

## Notes

- `--strict` と `--parallel` は同時指定可能
- 既に進行中タスクがある (artifacts/.task_id が存在) 場合、確認プロンプト表示
- `artifacts/` は `.gitignore` 対象、必要に応じてプロジェクト側でコミット運用を決める
