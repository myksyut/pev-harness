# Feedback Template

> **Note**: This template is for **organization-internal deployment** feedback aggregation (3 teams use the same form, results compared). Individual OSS users can use the standard [Issue templates](.github/ISSUE_TEMPLATE/) instead.

各チームが5タスク完了後、このテンプレで feedback を書く。GitHub Issue として起票 (title: `[feedback] <team-name>`)。

---

## Team
<team-name>

## Period
<YYYY-MM-DD to YYYY-MM-DD>

## Tasks summary

| # | Task one-liner | Outcome | Retries | Time |
|---|---|---|---|---|
| 1 | | PASS / FAIL / abandoned | 0/1/2/3 | XXm |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## What worked (具体的に)

3つ以上挙げる。例:

- planner が team-conventions の Forbidden を正しく反映した
- --strict mode の dual review が microservice境界の問題を catch した
- /pev-status --gc が古いtask の cleanup に役立った

## What didn't work / friction (具体的に)

3つ以上挙げる。例:

- Phase 2 で executor が「想定外のリファクタ」を入れた (N=2 tasks)
- verifier が「全 check PASS」と判定したが実際は test fixture が壊れていた
- `--strict` の token コストが想定の3倍以上だった

## Specific reproductions

問題が再現可能なら、artifacts/ または `~/.claude/pev/{TASK_ID}/` のスナップショットを添付:

```text
- Task X: artifacts/ snapshot at https://gist.github.com/... (or attach files to issue)
```

## Suggestions

優先度の高い改善案を3つ。 既存 Issue (`gh issue list`) との重複を確認してから:

1. (description, related issue if any)
2. ...
3. ...

## Quantitative observations

- 5 tasks 中 first-pass rate (no retry): ___ / 5
- 平均 retry数: ___
- 平均 token consumption (推定): ___
- `permissionMode` の各モード使用比率: `default: XX%` / `auto: XX%` / `plan: XX%`

## Overall sentiment

- 1 (このまま使わない) / 2 / 3 / 4 / 5 (主力ツール化したい)
- 1行コメント:

## What would unlock 5/5

何が変われば「主力ツールにしたい」と言えるか。 機能・UX・docs の何でも。

---

(このテンプレは v1.0 で配置。集まった feedback の傾向に応じて改訂する。)
