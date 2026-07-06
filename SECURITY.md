# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x | ✅ Active development, security fixes within 14 days |
| < 1.0 | ❌ Pre-release, no longer supported |

## Reporting a Vulnerability

pev-harness は Claude Code plugin であり、**コード自動実行を含むエージェント駆動ワークフロー**を扱います。脆弱性は agent prompt injection / 破壊的 bash 実行のすり抜け / git history 漏洩 等が想定されます。

### 報告チャネル (優先順)

1. **GitHub Security Advisory (推奨、private)**
   <https://github.com/myksyut/pev-harness/security/advisories/new>
   - GitHub 内で完結、暗号化済み、責任ある開示プロセス内蔵

2. **GitHub Issue (低リスクな問題のみ)**
   公開してOKなレベルの問題 (例: dependency lint warning) は通常の Issue でOK。

### 報告に含めてほしい内容

- 影響を受けるバージョン (例: `v1.0.0`)
- 脆弱性タイプ (prompt injection / privilege escalation / data exposure / etc.)
- 再現手順 (なるべく minimal)
- 想定されるユーザー影響
- (任意) 提案する修正

### 対応 SLA

| 段階 | 期限 |
|---|---|
| 受領確認 | 3 営業日以内 |
| 影響度評価 | 7 営業日以内 |
| Critical 修正リリース | 14 日以内 |
| Non-critical 修正リリース | 30 日以内 |

修正リリースと同時に CVE 取得 (Critical のみ) と GitHub Security Advisory 公開を行います。

### Disclosure Policy

- 修正 release 前の **公開禁止** (責任ある開示)
- 報告者の貢献は `SECURITY.md` および release notes でクレジット (希望時)
- 修正後 90 日以内に詳細を公開

## What's in scope

- agent prompt injection (planner / executor / verifier がmaliciousな入力を受けた時の挙動)
- hook bypass (`PreToolUse` deny-pattern を回避する破壊的コマンド)
- secret leakage (.pev-artifacts/ や memory directory への意図しない secret 流出)
- supply chain (CI workflow から外部 action 経由の侵入)
- Claude Code permission model のすり抜け

## What's out of scope

- Claude Code 本体の脆弱性 (Anthropic に報告: <https://claude.com/security>)
- Anthropic API の脆弱性 (同上)
- ユーザーが自分の手で `permissionMode=auto` にして破壊的 prompt を投入した場合 (これは設計上の trade-off)
- Third-party Claude プラグインの問題

## Threat model

pev-harness は **trusted developer のローカル環境で動作する開発支援 plugin** を想定しています。脅威モデルは以下:

- **想定する**: 悪意ある npm package を含むプロジェクトで agent が trojan を踏むリスク → hook の `PreToolUse` で部分緩和、完全防御は user の責任
- **想定する**: planner が `team-conventions.md` の内容を pivot して悪意ある指示に従う prompt injection → conventions ファイルは team レビュー対象とする運用で緩和
- **想定しない**: untrusted multi-tenant 環境 (例: SaaS 経由で外部ユーザーが prompt 投入する用途) — この用途では追加の sandbox / isolation が必要

## Hall of Fame

(脆弱性報告で contribute いただいた方を記載予定)

---

質問や上記に該当しないグレーゾーンの相談は `discussion` で気軽に。
