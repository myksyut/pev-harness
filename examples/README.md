# pev-harness Examples

> **v3.0+ note**: 例は当初の 3-phase pipeline 前提で書かれている。 v3.0 では Phase 0 (Triage) が追加され Plan は on-demand 化された ([CLAUDE.md](../CLAUDE.md) / [SPEC.md §4](../SPEC.md) 参照)。 例自体は Plan が走ったケースとして読める。

dog food 前に「PEV pipelineを通すと実際にどうなるか」を見るための参考ファイル群。

## Files

| File | 目的 |
|---|---|
| `plan.example.md` | Phase 1 完了後の `artifacts/plan.md` 完成例 |
| `execute.example.log` | Phase 2 完了後の `artifacts/execute.log` 例 |
| `verify.example.json` | Phase 3 完了後の `artifacts/verify.json` 例 (PASS) |
| `verify.fail.example.json` | retry triggerされる FAIL 例 |
| `recap.example.log` | 1タスク分の recap.log 完成例 |
| `team-conventions.example.md` | プロジェクトルートに置く team-conventions のテンプレ |
| `sample-project/` | dog food用の最小サンプルプロジェクト |

## How to use

参考にしたいだけなら開いて読むだけでOK。

実行例として動かしたい:

```bash
cd ~/pev-harness/examples/sample-project
claude --plugin-dir ~/pev-harness
> /pev-harness:pev "Implement the TODO in src/index.js"
```

## Tip

`plan.example.md` をテンプレートとして直接 `artifacts/plan.md` にコピーすると、Phase 2 (Execute) から手動で開始することもできる。検証用途に便利。
