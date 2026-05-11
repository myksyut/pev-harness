# Project context for pev-harness dog food

このディレクトリは pev-harness を `--plugin-dir` で読み込んで動作確認するための minimal sample-project。

## Linear integration

Linear team の設定は `.linear-config.yml` に書く (workspace / team.id / status_mapping)。

Template: `.linear-config.yml.example`

セットアップ:

```bash
cp .linear-config.yml.example .linear-config.yml
# 値を実 Linear workspace に合わせて編集
```

`labels` は yaml に書かない (skill が動的に取得)。

## Team conventions

技術規約は `team-conventions.md` に書く (現状: JS ESM、 vitest、 2-space indent、 etc.)。
これは `pev-team-conventions` skill が読み込んで planner/executor の prompt に注入する。

## Notes

- このディレクトリは **dog food 専用**。 実プロジェクトに pev-harness を導入する際は、 各自のプロジェクトルートに `.linear-config.yml` と `team-conventions.md` を配置する。
- `artifacts/` と `node_modules/` は gitignore 対象。
- dog food 実施手順は `docs/TEST-PLAN-linear-v1.3.md` 参照。
