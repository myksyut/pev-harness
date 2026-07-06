# Project context for pev-harness dog food

このディレクトリは pev-harness を `--plugin-dir` で読み込んで動作確認するための sample-project。 v1.7.1+ では **イベント参加申し込みフォーム** をモチーフにした、 実務でよく出る形 (フォーム validation / 二重送信防止 / LocalStorage 永続化 / accessibility / E2E) を持つ fixture。

## Domain

イベント参加申し込みフォーム:

- 氏名 (必須、 1-50 文字)
- メールアドレス (必須、 形式 check)
- 電話番号 (任意、 日本の電話番号 10-11 桁)
- 参加プラン (必須、 standard / premium / student)
- 利用規約同意 (必須)
- 二重送信防止 + 送信中 button disabled
- 成功時 LocalStorage に append + success message + form reset

## Files

- `src/validation.js` — 各 field の純粋 validator + `validateForm` aggregate
- `src/form.js` — submit handler / LocalStorage 永続化 / 二重送信制御 (`buildSubmitHandler` factory)
- `index.html` — form UI (accessible: label/aria-required/aria-describedby/role=alert)
- `tests/validation.test.js` — 境界値網羅 (空、 51文字、 不正 email、 etc.)
- `tests/form.test.js` — mock storage + fake timer で submit flow / 二重送信 / persistence を test
- `tests-e2e/seed.spec.ts` — Playwright 正常パス + 必須欠落 + email 不正 + 二重送信防止

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
- `.pev-artifacts/` と `node_modules/` は gitignore 対象。
- dog food 実施手順は `guide/TEST-PLAN-linear-v1.3.md` 参照。
