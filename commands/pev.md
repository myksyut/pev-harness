---
description: Run full Plan-Execute-Verify pipeline for a coding task
---

# /pev

PEV harnessのメインコマンド。Plan → Execute → Verify を順に実行する。

## Usage

```text
/pev <task description>
/pev <task> --strict       # dual review有効化
/pev <task> --parallel     # 独立ファイル変更を並列実行
/pev <linear-issue-url>    # (v1.x) Linear Issueから自動展開
```

## フロー

1. `pev-spec-template` skill で入力を整形 (Goal/Constraints/AC不足なら質問返し)
2. **Phase 1 (Plan)**: planner agent → `artifacts/plan.md`
3. **Gate A**: `permissionMode` 判定で auto / 停止 / 終了 を分岐
4. **Phase 2 (Execute)**: executor agent → コード変更 + `artifacts/execute.log`
5. **Gate B**: Stop hook が verifier を促す
6. **Phase 3 (Verify)**: verifier agent (`--strict` 時は `pev-dual-review`) → `artifacts/verify.json`
7. **Retry Gate**: PASS → 完了 / FAIL → planner に戻る (max 3回)

## Gate A の挙動

| permissionMode | Gate A |
|---|---|
| `auto` | スキップ → Phase 2 自動進行 |
| `default` | 停止 → ユーザーが `/pev-execute` で続行 |
| `plan` | plan.md 表示して終了 |

## Implementation note

task_id 発行 / permissionMode 検出 / Retry counter / --strict 分岐の具体的な Bash 実装は v0.2 で確実に動作する形に。詳細は [Issue #1](https://github.com/myksyut/pev-harness/issues/1) を参照。

v0.1 ではこの md ファイルの記述を Claude Code agent が解釈して動作する想定。
