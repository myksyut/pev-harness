# pev-harness

[![CI](https://github.com/myksyut/pev-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/myksyut/pev-harness/actions/workflows/ci.yml)
![version](https://img.shields.io/badge/version-1.0.0-blue)
![status](https://img.shields.io/badge/status-production--ready-green)
![claude--code](https://img.shields.io/badge/Claude%20Code-%E2%89%A5v2.1.111-purple)

Claude Opus 4.7時代のコーディングハーネス。**Plan → Execute → Verify** の3-phase pipelineを強制し、4.7のnative機能を最大活用する Claude Code plugin。

**v1.0 production-ready** (2026-05-11). 社内チーム展開準備完了。詳細は [ONBOARDING.md](./ONBOARDING.md) / [ROLLOUT-CHECKLIST.md](./ROLLOUT-CHECKLIST.md)。

## なぜ作ったか

Opus 4.7のリリース (2026-04) で、4.6時代のプロンプトテクニック (`step by step`、`double-check before returning` 等) が**逆効果**になることが公式に明言された。一方、Claude Code側にも Auto Mode / Focus Mode / Session Recaps / Task Budget / xhigh effort 等の新機能が追加された。

これらを前提に**ゼロベースで再設計**したのが pev-harness。

## 設計哲学

- **ミニマル**: agent 3個 / skill 8個 / command 5個 / hook 3個のみ
- **4.7-native**: 4.6以前との後方互換性なし (Claude Code v2.1.111+ 必須)
- **Convention over configuration**: ゼロconfigで動く
- **Hook-driven**: 検証は prompt に書かず hook で強制

## クイックスタート

```bash
# Install (plugin として)
cd ~/.claude/plugins
git clone <repo-url> pev-harness

# Verify
claude --version  # ≥ v2.1.111
```

プロジェクトで使う:

```
/pev "Add /healthz endpoint that returns {status: 'ok'}"
```

これで Plan → Execute → Verify が自動で順に走る。詳細は [ONBOARDING.md](./ONBOARDING.md)。

## アーキテクチャ

```
/pev <task>
  ↓
[Phase 1: PLAN]    planner   (opus, xhigh)   → artifacts/plan.md
  ↓                Gate A: permissionMode判定
[Phase 2: EXECUTE] executor  (sonnet, high)  → code edits + execute.log
  ↓                Gate B: Stop hookで自動起動
[Phase 3: VERIFY]  verifier  (sonnet, xhigh) → verify.json
  ↓
PASS → done       FAIL → planに戻る (最大3回)
```

完全な仕様は [SPEC.md](./SPEC.md)。

## 必須プロンプト構造 (初回ターン)

```
Goal: <達成したいこと>
Constraints: <やってはいけないこと、依存制約>
Acceptance Criteria: <成功の判定方法>
Files: <既知の関連パス、任意>
```

これらが揃っていない場合、planner はコード1行も読まずに**まず質問返し**する。

## 何をやらないか

- 言語別ヘルパー追加 (プロジェクト側のtoolingを使う)
- 自動フォーマット (プロジェクト側のformatterを使う)
- gitコミットの管理 (人間が境界を決める)
- 50個の specialized agent (ECCとは違う、ここではミニマル)

## ロードマップ

| Version | スコープ |
|---|---|
| v0.1 | skeleton + minimal flow (現在) |
| v0.5 | チーム展開準備完了 |
| v1.0 | 社内3チーム展開 |
| v1.1 | Linear連携 skill |
| v2.0 | MCP経由の外部model対応 |

## License

MIT
