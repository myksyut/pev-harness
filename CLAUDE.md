# pev-harness

Opus 4.7 native Plan-Execute-Verify harness. プラグインとしてロードされた際、Claude Code はこのファイルを読む。

## How to use

- 非自明なタスクは `/pev <description>` で開始する
- Phase別実行: `/pev-plan`, `/pev-execute`, `/pev-verify`
- 進捗確認: `/pev-status`

## Required initial-turn prompt structure

タスク開始時、以下を提示する:

- **Goal**: 達成したいこと
- **Constraints**: やってはいけないこと、依存制約
- **Acceptance Criteria**: 成功の判定方法
- **Files** (任意): 既知の関連パス

不足している場合、planner はコード1行も読まずに**まず質問返し**する。Opus 4.7はliteralに指示を解釈するため、暗黙の文脈に頼らない。

## このharnessがやらないこと

- 言語別の自動フォーマット (プロジェクト側のtoolingを使う)
- git commitの境界判断 (人間が決める)
- 4.6時代のscaffolding ("step by step", "double-check" 等) — 4.7では逆効果

## artifacts/ ディレクトリ

タスク固有の中間生成物。`.gitignore` 対象。

- `plan.md` — Phase 1出力
- `execute.log` — Phase 2ログ
- `verify.json` — Phase 3結果
- `recap.log` — phase完了サマリ蓄積

## Team conventions

`team-conventions.md` がプロジェクトルートにあれば、planner/executor が自動で読み込む (pev-team-conventions skill経由)。

## 4.7-native 機能の活用

| 機能 | このharnessでの位置付け |
|---|---|
| xhigh effort | planner / verifier の既定値 |
| adaptive thinking | 全phase既定で有効 |
| task budget | pev-task-budget skill で phase別管理 |
| Auto Mode | permissionMode=auto時にGate Aスキップ |
| Focus Mode | Execute phase 5分超で pev-focus-mode が推奨 |
| Session Recaps | pev-recap で artifacts/recap.log に蓄積 |
| Subagent memory | ~/.claude/pev/{task_id}/ 配下に標準化 |
