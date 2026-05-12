# Rollout Checklist (per-team)

> **Note**: This document is for **organization-internal deployment** tracking. Individual OSS users don't need this — just follow [ONBOARDING.md](./ONBOARDING.md).

各チームへの導入時、ロールアウト管理者がチェック。Issue #7 (v1.0) のAC達成を追跡するため。

## Team: ___________
## Lead: ___________
## Rollout date: ___________

---

## Pre-rollout (個別メンバー分)

各メンバーごとに確認:

- [ ] Claude Code ≥ v2.1.111 がインストール済み (`claude --version`)
- [ ] GitHub アカウントが `myksyut/pev-harness` への access ありcollaborator追加済み
- [ ] `~/.claude/plugins/repos/myksyut/pev-harness` に clone or `--plugin-dir` で session 起動できる
- [ ] `/pev-harness:pev` がコマンド一覧に出る (`/help` で確認)
- [ ] ONBOARDING.md を読了
- [ ] (Linear sync を使うチーム) `linear@claude-plugins-official` plugin を install + OAuth 認証完了 (ONBOARDING §1.5 参照)
- [ ] (`--reviewer dual-codex` を使うチーム) Codex CLI install + `codex auth login` 完了

## Project preparation

導入対象プロジェクトごとに:

- [ ] `team-conventions.md` を作成 (`examples/team-conventions.example.md` ベース)
- [ ] team-conventions.md の `## Language & Stack` / `## Code style` / `## Forbidden` / `## Files to never touch` を プロジェクト固有に編集
- [ ] `.gitignore` に `artifacts/` 追加
- [ ] team-conventions.md と .gitignore を commit (`chore: adopt pev-harness team conventions`)
- [ ] (オプション) `.claude/settings.json` でプロジェクトの `permissionMode` 既定値を設定

## First task (dog food per team)

- [ ] チームメンバーが各自で**1タスク**を `/pev-harness:pev` で実行
- [ ] plan.md の品質を team でレビュー (Constraints が team-conventions を反映しているか)
- [ ] Gate A で停止することを確認 (`permissionMode=default`)
- [ ] `/pev-harness:pev-execute` で続行できる
- [ ] verify.json で AC が met されている
- [ ] `~/.claude/pev/{TASK_ID}/` に memory file (notes.md / executor-N.md / verifier.md) が生成される

## Post-rollout / feedback collection

- [ ] チームが最低 **5 タスク**を pev-harness で完了
- [ ] `FEEDBACK-TEMPLATE.md` のフォーマットでフィードバックを書く
- [ ] フィードバックを GitHub Issue として起票 (or Slack #pev-harness で議論 → Issue 化)
- [ ] フィードバックから次イテレーションの優先度を決定

## Issue #7 tracking

3 チーム分のチェックリスト完了で Issue #7 を close:

- [ ] Team 1: ___________
- [ ] Team 2: ___________
- [ ] Team 3: ___________

完了したら:

```bash
gh issue close 7 --comment "All 3 teams rolled out. Feedback collected in Issues #__, #__, #__. v1.1 priorities determined."
```

## トラブル対応

ロールアウト中に遭遇した問題は `ONBOARDING.md` §6 FAQ を参照。 FAQ にない問題は新規 Issue 起票。
