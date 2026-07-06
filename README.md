# pev-harness

[![CI](https://github.com/myksyut/pev-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/myksyut/pev-harness/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/myksyut/pev-harness?style=social)](https://github.com/myksyut/pev-harness/stargazers)
![version](https://img.shields.io/badge/version-4.3.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![claude--code](https://img.shields.io/badge/Claude%20Code-%E2%89%A5v2.1.156-purple)

**Claude Code に「計画 → 実装 → 検証」の型を与える plugin。**

`/pev "タスク"` と投げるだけで、 曖昧な依頼は **質問して仕様化** し、 実装は **安いモデルに委譲** し、 完成したかどうかは **実装者とは別の verifier がテストを回して判定** します。 高いモデルは判断だけ、 安いモデルは作業だけ — この役割分担で、 素の Claude Code より **壊れにくく・検証付きで・安く** なります。

**コマンド名について**: plugin として install した場合、 実際のコマンドは plugin namespace 付きの **`/pev-harness:pev`** です (`/pev-init` → `/pev-harness:pev-init` 等も同様)。 本 README では以降、 読みやすさのため `/pev` と略記します。

> ⭐ 役に立ったら [star](https://github.com/myksyut/pev-harness/stargazers) をお願いします。

## 3 行でいうと

1. **勝手に作らない** — 仕様が曖昧なら実装前に質問が返ってくる (対話できない実行では、 根拠付きのデフォルトを明示して確定)
2. **自己申告を信じない** — 「できました」ではなく、 独立した verifier がテストを書いて exit code で PASS/FAIL を判定。 FAIL なら自動で直して再検証 (最大 3 回)
3. **金額を設計する** — 指揮は Fable 5、 計画は Opus、 実装/検証は Sonnet か Codex。 トークンの重い仕事ほど安いモデルに落ちる

## 実測: 同じ「マイクラ作って」を投げると

同一プロンプトを 4 構成に投げた実測 (2026-07、 詳細は [費用モデルと全 findings](./experiments/v4.2-fable-orchestrator-cost.md)):

| 構成 | 金額 | 成果物 | 検証 |
|---|---|---|---|
| Claude Code 素 (Opus 単独) | $1.69 | ❌ 描画が崩壊したゲーム | なし |
| Claude Code 素 (Fable 単独) | $8.85 | ◎ リッチだが野放図に作り込む | なし (自己申告のみ) |
| **pev-harness (本 plugin)** | **$5.33** | **◎ テクスチャ/ホットバー/FPS 表示まで同等品質** | **✅ 独立 verifier が自作テストで PASS 判定** |
| 〃 (実装バグが出た回) | $8.98 | ◎ | ✅ **FAIL を検出 → 自動修正 → 再検証で PASS** (retry 機構の実戦例) |

つまり: **Fable 級の品質を約 4 割引きで、 しかも検証付きで** 出すのがこの harness の現在地です。

## 仕組み

```text
  あなた: /pev "タスク"
       ↓
  指揮層 (Fable 5) … 各フェーズの起動と進行判定だけを行う。 実装ファイルは読まない
       ↓
  [0] TRIAGE  (Sonnet)  計画が要るタスクか 1 ターンで判定
       ↓ 要る場合のみ
  [1] PLAN    (Opus)    仕様の穴を質問 or 根拠付きデフォルトで確定 → plan.md
       ↓ ここで人間のレビュー (Gate A: 設定が default なら必ず停止)
  [2] EXECUTE (Sonnet or Codex CLI)  plan 通りに実装 → execute.log
       ↓
  [3] VERIFY  (Sonnet)  実装者とは別タスクで起動、 テストを実行して verify.json に PASS/FAIL
       ↓
  PASS → 完了    FAIL → 自動で再計画 → 再実装 → 再検証 (最大 3 回、 超えたら人間へ)
```

押さえどころは 3 つ:

- **Gate A (人間の承認ポイント)**: 計画が立った直後、 permissionMode が `default` なら必ず止まって plan.md を見せます。 軽いタスクは `auto` で素通し、 重要な変更だけレビュー、 という運用ができます
- **検証の独立性**: verifier は実装した agent と別のタスクとして起動され、 実装側のテストを鵜呑みにせず自分でテストを書くことも許可されています。 「実装者の自己採点で PASS」 は構造的に起きません
- **コスト規約**: 指揮層 (Fable、 Opus の 2 倍単価) は artifacts の読み書きと指示だけ。 実装ファイルを読む・コードを書くのは常に安い層の仕事です

## Quick start

### A) 個人 install (全 project で使える)

```bash
# 1) install
claude plugin marketplace add myksyut/pev-harness
claude plugin install pev-harness@pev-harness

# 2) project の初期化 (team-conventions.md / .gitignore / 言語検知を 1 コマンドで)
cd <your-project>
claude
> /pev-harness:pev-init

# 3) 最初のタスク
> /pev-harness:pev "Add a /healthz endpoint that returns {status: 'ok'}"
```

### B) team 共有 install (project に固定)

```bash
cd <your-project>
claude plugin marketplace add myksyut/pev-harness
claude plugin install pev-harness@pev-harness --scope project
git add .claude/settings.json && git commit -m "chore: adopt pev-harness team-wide"
```

teammate は clone → `claude` 起動 → trust prompt に同意で自動 install。 詳細は [ONBOARDING §1.2](./ONBOARDING.md#12-project-scope-install-team-共有-v215-推奨)。

### C) install せず試す

```bash
git clone https://github.com/myksyut/pev-harness.git
claude --plugin-dir ./pev-harness
> /pev-harness:pev-init
> /pev-harness:pev "..."
```

## タスクの投げ方

一番効くのは **最初のプロンプトに以下を入れる** ことです (欠けていても動きます — planner が質問で埋めます):

```text
Goal: 達成したいこと
Constraints: やってはいけないこと・依存制約
Acceptance Criteria: 成功の判定方法
Files: 既知の関連パス (任意)
```

### よく使う flag

| Flag | 意味 |
|---|---|
| (なし) | Triage が計画の要否を判定する標準フロー |
| `--with-plan` | 判定を skip して必ず計画から始める |
| `--no-plan` | 判定を skip して即実装 (明確な小タスク向け) |
| `--force-auto` | Gate A の停止を今回だけ skip (CI / 自動化用。 planner 自身は使えない) |
| `--strict` | 検証を dual review (Opus + Sonnet の 2 名体制) に強化 |
| `--executor-mode=claude` | 実装を Codex CLI でなく Claude で行う (default は codex、 未 setup なら自動で claude に fallback) |
| `--expect-fail` | 「FAIL が正解」の fixture 用。 retry を回さない |

### 品質の自動切替

- **業務コード / 既存 codebase**: 仕様の穴は質問で確認、 grey-zone は保守的に (勝手に機能を盛らない)
- **ゼロから作る体験モノ (ゲーム・デモ等)**: 対話できない実行では「動くだけの最小版」に倒さず、 テクスチャ・操作 UI・FPS 表示・環境演出まで AC に含めて作ります (v4.2.1 の rich 品質バー。 上の実測はこれ)

### 実行ログ (session telemetry、 v4.3+)

各 task の実行記録が `artifacts/session.json` に自動で残ります — user prompt 原文 / 実行時 git 状態 (再現テスト用) / phase ごとの timing / token 消費 (概算) / user 入力 chat log / 任意の session 評価。 完了時に `~/.claude/pev/telemetry/` へ archive されるので、 「素の Claude Code に同じタスクを投げて比較する」 ベンチマーク dataset として蓄積できます。 **local file のみで外部送信はしません**。 不要なら `PEV_TELEMETRY=off`。

## Optional integrations

core 機能は単体で動きます。 使う分だけ:

| 連携 | 用途 | setup |
|---|---|---|
| **Codex CLI** | Execute phase の実装エンジン (API 課金ゼロ) / 外部 reviewer | `brew install openai/tap/codex && codex auth login` → `/pev-init-codex` |
| **Linear** | issue 起点の開発 (`/pev <linear-url>`)、 実装前 issue 自動作成 | `claude plugin install linear@claude-plugins-official` (OAuth) |
| **Playwright** | UI タスクの E2E 検証 | `/pev-init-e2e` が `.mcp.json` と agents を自動生成 |

install しない場合は該当機能が warning 付きで skip されるだけで、 pipeline は止まりません。

## Components

| 種類 | 内容 |
|---|---|
| **agents** (4) | triage / planner / executor / verifier |
| **skills** (20) | pev-pipeline, pev-spec-template, pev-task-budget, pev-focus-mode, pev-recap, pev-subagent-memory, pev-dual-review, pev-team-conventions, pev-test-design, pev-e2e-verify, pev-bootstrap-playwright, pev-bootstrap-project, pev-bootstrap-codex, pev-external-reviewer, pev-external-executor, pev-linear-sync, linear-issue-workflow, linear-project-workflow, linear-project-tracker, empirical-prompt-tuning |
| **commands** (9) | `/pev`, `/pev-plan`, `/pev-execute`, `/pev-verify`, `/pev-verify-e2e`, `/pev-status`, `/pev-init`, `/pev-init-e2e`, `/pev-init-codex` |
| **hooks** (3) | PreToolUse (破壊的コマンドの block) / Stop (recap 自動追記 + telemetry 集計) / SessionStart (task 再開) |
| **rules** (3) | `pev-conventions.md` (Gate 遵守・model tiering) / `native-prompting.md` (4.X で逆効果な定型句の禁止リスト) / `error-patterns.md` (エラー推測 catalog) |

### モデル構成 (v4.2+)

| 層 | Model / Effort | 単価 ($/MTok in/out) |
|---|---|---|
| 指揮 (main session) | Fable 5 / high | 10 / 50 |
| Triage | Sonnet / low | 3 / 15 |
| Plan | Opus 4.8 / xhigh | 5 / 25 |
| Execute | Sonnet / high (default: Codex CLI 委譲) | 3 / 15 (codex は 0) |
| Verify | Sonnet / xhigh | 3 / 15 |

Fable が使えない環境 (ZDR org 等) は `.claude/settings.local.json` で `"model": "claude-opus-4-8"` に override すれば従来構成で動きます。

## Documentation

- [SPEC.md](./SPEC.md) — 完全仕様 (12 章 + ADR 10 件)
- [ONBOARDING.md](./ONBOARDING.md) — Installation, troubleshooting, FAQ
- [experiments/](./experiments/) — 設計判断の根拠実験 (harness-effect-v1〜v19)
- [CHANGELOG.md](./CHANGELOG.md) — version history
- [CONTRIBUTING.md](./CONTRIBUTING.md) / [SECURITY.md](./SECURITY.md)

## Design philosophy

| | |
|---|---|
| **P1** | Single source of truth — 1 phase に 1 agent / 1 skill |
| **P2** | 4.X-native — 「step-by-step」等の旧世代 scaffolding を書かない (公式に逆効果と明示) |
| **P3** | No backwards compat — Claude Code v2.1.156+ 必須 |
| **P4** | Convention over configuration — settings.json デフォルトで動く |
| **P5** | 検証は仕組みで強制 — agent の自己申告でなく hook / 独立 dispatch / exit code で担保 |

## What this harness does NOT do

- 言語別ヘルパーの追加 (プロジェクト側の tooling を使う)
- 自動 git commit (人間が境界を決める)
- 自動フォーマット (プロジェクト側の formatter)
- 50 個の specialized agent (agent 4 個でミニマルに完結)

## Roadmap (抜粋)

| Version | スコープ | Status |
|---|---|---|
| v0.1〜v2.1 | PEV pipeline 完成 / Linear / Playwright E2E / Codex reviewer / team install | ✅ released |
| **v3.0** | 大型再設計 — Triage 新設、 Plan on-demand 化、 質問返しの必須化 | ✅ released |
| v3.5〜v3.7 | Codex CLI を Execute の default エンジンに | ✅ released |
| v4.0〜v4.1 | retry 駆動を公式 `/goal` primitive に一本化 (独立検証の dispatch は harness が保持) | ✅ released |
| **v4.2〜v4.2.1** | **Fable orchestrator + model tiering** — 実測で Fable 単独比 −40% / rich 品質バー / orchestrator 薄型化 | ✅ released |
| **v4.3** | **session telemetry** — prompt / git / timing / tokens / 評価を session.json に記録 (local-only) | ✅ released |
| **v5.0 (予定)** | breaking: `.pev-artifacts/` rename + CrossRepo 対応 + コマンド/フラグの surface 削減 | 計画中 |
| future | orchestrator turn 統合 (コスト比率 15% 目標) / Gemini CLI 対応 / opt-in telemetry 外部収集 | [Issues](https://github.com/myksyut/pev-harness/issues) |

全履歴は [CHANGELOG.md](./CHANGELOG.md)、 各 release の根拠実験は [experiments/](./experiments/) 参照。

## Contributing

Bug report / feature request は [Issues](https://github.com/myksyut/pev-harness/issues)、 質問は [Discussions](https://github.com/myksyut/pev-harness/discussions) へ。 詳細は [CONTRIBUTING.md](./CONTRIBUTING.md)。 脆弱性は [SECURITY.md](./SECURITY.md) の手順で private に。

## License

MIT — see [LICENSE](./LICENSE).

---

> **Note**: pev-harness は **trusted developer の local 環境** で動作する開発支援 plugin として設計されています。 SaaS / 共有環境での運用には追加の sandbox / isolation が必要です。 詳しくは [SECURITY.md](./SECURITY.md) の threat model 参照。
