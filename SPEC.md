# pev-harness Specification

Claude Opus 4.7時代のコーディングハーネス。Plan-Execute-Verify (PEV) 3-phase pipelineを核に、4.7のnative機能（xhigh effort, adaptive thinking, task budget, auto mode）を前提として設計する。

- **対象**: チーム内共有
- **配布**: Claude Code plugin単独
- **設計哲学**: ミニマル削ぎ落とし。core skill 8個、agent 3個、command 5個、hook 3個のみ。

---

## 1. 設計原則 (P1-P5)

| # | 原則 | 反対パターン |
|---|---|---|
| **P1** | **Single source of truth** — 1 phaseに1 agent / 1 skill。重複させない | "continuous-learning" と "continuous-learning-v2" の並立 |
| **P2** | **4.7-native** — xhigh / adaptive thinking / task budget / auto modeを前提 | 4.6以前のscaffolding（"step by step"等）を一切書かない |
| **P3** | **No backwards compat** — レガシー考慮ゼロ。Claude Code v2.1.111+ 必須 | 新旧両対応の分岐コード |
| **P4** | **Convention over configuration** — settings.jsonデフォルトで動く | 環境変数を10個要求するhook |
| **P5** | **Hook-driven verification** — 検証はpromptに頼らずhookで強制 | "verify before returning" を agent prompt に書く |

---

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│              /pev <task>  または 自然言語入力                │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
        ┌─────────────────────────────────────┐
        │  PHASE 1: PLAN                       │
        │  agent: planner   model: opus-4-7    │
        │  effort: xhigh    budget: 50k tokens │
        │  output: artifacts/plan.md           │
        └────────────┬────────────────────────┘
                     │ Gate A: permissionMode依存
                     │   - "auto"     → スキップ
                     │   - "default"  → 停止 (ユーザー承認待ち)
                     │   - "plan"     → ここで終了
                     ▼
        ┌─────────────────────────────────────┐
        │  PHASE 2: EXECUTE                    │
        │  agent: executor  model: sonnet-4-6  │
        │  effort: high     並列起動可 (max 3) │
        │  output: code edits + execute.log    │
        └────────────┬────────────────────────┘
                     │ Gate B: Stop hookでverify自動起動
                     ▼
        ┌─────────────────────────────────────┐
        │  PHASE 3: VERIFY                     │
        │  agent: verifier  model: sonnet-4-6  │
        │  effort: xhigh                       │
        │  必須: build / type / lint / test    │
        │  任意: --strict 時のみ dual review   │
        │  output: artifacts/verify.json       │
        └────────────┬────────────────────────┘
                     │
            PASS ◀───┴───▶ FAIL → Plan に戻る (最大3回)
              │
              ▼
           [DONE] + recap自動生成
```

---

## 3. リポジトリ構造

```
pev-harness/
├── .claude-plugin/
│   └── plugin.json
├── agents/                                # 3つ
│   ├── planner.md                         # opus, xhigh
│   ├── executor.md                        # sonnet, high
│   └── verifier.md                        # sonnet, xhigh
├── skills/                                # 8つ
│   ├── pev-pipeline/SKILL.md
│   ├── pev-spec-template/SKILL.md
│   ├── pev-task-budget/SKILL.md
│   ├── pev-focus-mode/SKILL.md
│   ├── pev-recap/SKILL.md
│   ├── pev-subagent-memory/SKILL.md
│   ├── pev-dual-review/SKILL.md
│   └── pev-team-conventions/SKILL.md
├── commands/                              # 5つ
│   ├── pev.md
│   ├── pev-plan.md
│   ├── pev-execute.md
│   ├── pev-verify.md
│   └── pev-status.md
├── hooks/
│   └── hooks.json                         # 3 hook
├── rules/
│   ├── pev-conventions.md
│   ├── 4.7-native.md
│   └── error-patterns.md
├── guide/                                  # 開発者向け internal doc
│   ├── CHECKLIST.md
│   ├── ROLLOUT-CHECKLIST.md
│   ├── FEEDBACK-TEMPLATE.md
│   ├── dogfood-v1.3-report.md
│   └── TEST-PLAN-linear-v1.3.md
├── settings.json
├── CLAUDE.md
├── README.md
├── ONBOARDING.md
└── SPEC.md (この文書)
```

**意図的に存在しないもの**:
- `scripts/` (plugin単独、Node.jsヘルパー不要)
- `tests/` (plugin内容物のみ、validateは GitHub Actions の lint で代替)
- 言語別patterns / 業界特化skill
- GAN harness、複数loop variant

---

## 4. Plan-Execute-Verify 詳細

### Phase 1: Plan

agent `agents/planner.md`：
- `model: opus`, `effort: xhigh`
- tools: Read / Grep / Glob / Write
- 入力契約: **Goal / Constraints / Acceptance Criteria** (必須)、関連ファイルパス (任意)
- 入力不足時はコード1行も読まずに**まず質問返し**
- 出力: `artifacts/plan.md`
- Task budget: 50k tokens (`pev-task-budget` skillで指定)

### Phase 2: Execute

agent `agents/executor.md`：
- `model: sonnet`, `effort: high`
- tools: Read / Edit / Write / Bash / Grep / Glob
- 入力: `artifacts/plan.md` の File-level changes
- 並列化: 独立した複数ファイル変更がある場合、最大3 executor を同時起動 (`PEV_PARALLEL_EXECUTOR_MAX`)
- Subagent memory: `~/.claude/pev/{task_id}/executor-{N}.md`

### Phase 3: Verify

agent `agents/verifier.md`：
- `model: sonnet`, `effort: xhigh`
- tools: Read / Bash / Grep
- 実行手順 (hard-coded、変更不可):
  1. `git diff` で変更取得
  2. plan.md の Verification strategy を実行
  3. Acceptance Criteria を1つずつ ✅/❌ チェック
  4. `artifacts/verify.json` に書き出し
  5. FAIL あれば planner に diff + 失敗内容を渡してリトライ (最大3回)
- `--strict` モード: `pev-dual-review` skill が起動し、Reviewer A=Opus 4.7、Reviewer B=Sonnet 4.6 を並列実行

### Phase Gates

| Gate | 位置 | 挙動 |
|---|---|---|
| **A** | Plan → Execute | `permissionMode` 判定。auto時スキップ、default時停止、plan時終了 |
| **B** | Execute → Verify | Stop hookが自動でverifier起動 |
| **Retry** | Verify FAIL時 | plan.md と diff を planner に戻す、最大3回 |

---

## 5. Hooks (3つだけ)

`hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "deny-pattern", "patterns": [
          "rm -rf /", "rm -rf ~", "git push --force.*main", "git reset --hard.*origin"
        ]}]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [{"type": "command", "command": "test -f artifacts/plan.md && test -f artifacts/execute.log && echo '[PEV] Execute phase complete. Run /pev-verify to validate.'"}]
      }
    ],
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [{"type": "command", "command": "test -f artifacts/plan.md && echo '[PEV] In-progress task detected. Run /pev-status'"}]
      }
    ]
  }
}
```

**意図的に入れないhook**:
- PostToolUse format hook (プロジェクト側に任せる)
- cost tracker (Claude Code本体のrecapsで代替)
- session persistence (artifacts/ で自然永続化)

---

## 6. Settings (team default)

`settings.json`:

```json
{
  "model": "claude-opus-4-7",
  "effortLevel": "xhigh",
  "permissionMode": "default",
  "skillOverrides": "user-invocable-only",
  "env": {
    "PEV_TASK_BUDGET": "100000",
    "PEV_MAX_RETRIES": "3",
    "PEV_STRICT_MODE": "false",
    "PEV_PARALLEL_EXECUTOR_MAX": "3"
  }
}
```

- `permissionMode` のデフォルトは安全側の `default`
- Auto Mode利用者は Shift+Tab でセッション内切替、または `.claude/settings.local.json` で個別上書き

---

## 7. Skills 一覧

| Skill | 役割 | トリガー |
|---|---|---|
| **pev-pipeline** | フルパイプライン定義、phase間受け渡し規約、artifacts/ 仕様 | `/pev` 起動時 |
| **pev-spec-template** | Goal/Constraints/AC を含む初回プロンプト雛形 | タスク開始時 |
| **pev-task-budget** | task_budget API beta header利用、phase別推奨予算 | 各phase起動時 |
| **pev-focus-mode** | 長時間タスクで `/focus` を促す | Execute phase 5分超 |
| **pev-recap** | phase完了時に短い recap を `artifacts/recap.log` に追記 | 各phase終了時 |
| **pev-subagent-memory** | `~/.claude/pev/{task_id}/` 配下のmemoryディレクトリ規約 | executor並列起動時 |
| **pev-dual-review** | santa-method軽量版。Reviewer A=Opus / B=Sonnet (model alias diversity) | `--strict` 指定時 |
| **pev-team-conventions** | `team-conventions.md` を読み込み planner/executor に注入 | Plan/Execute起動時 |
| **pev-bootstrap-playwright** | Playwright + agents の one-time setup (v1.4+) | `/pev-init-e2e` / E2E preflight 未setup |
| **pev-bootstrap-project** | project 全体の初期 setup (team-conventions / .gitignore / 言語検知) (v1.9+) | `/pev-init` |
| **empirical-prompt-tuning** | skill / slash command / プロンプトを subagent で実走させ自己申告 + 指示側メトリクスで反復改善 (v2.1+) | skill / プロンプト新規作成・大幅改訂直後 |

---

## 8. Commands

| Command | 説明 |
|---|---|
| `/pev <task>` | フルpipeline。Plan → Execute → Verify を順に実行、Gate A/B で停止判定 |
| `/pev-plan <task>` | Plan のみ実行、`artifacts/plan.md` 出力 |
| `/pev-execute` | 既存 plan.md を読んで実装 |
| `/pev-verify` | 検証のみ実行 |
| `/pev-status` | 現在のphase / artifacts一覧 / 残り task budget |
| `/pev-verify-e2e` | E2E verify のみ実行 (v1.4+) |
| `/pev-init-e2e` | Playwright bootstrap (v1.4+) |
| `/pev-init [--dry-run] [--force]` | project 全体の初期セットアップ (v1.9+)。 team-conventions.md / .gitignore / (任意) .linear-config.yml.example 等を言語検知付きで生成 |

各commandは10〜30行の薄いMarkdown。ロジックはskill側。

---

## 9. artifacts/ 規約

```
artifacts/                       # .gitignore対象
├── plan.md                      # Phase 1出力
├── execute.log                  # Phase 2ログ
├── verify.json                  # Phase 3結果
├── recap.log                    # phase完了サマリ
└── linear/                      # v1.x で追加予定
    ├── issue_id.txt
    └── sync_state.json
```

`task_id` はタスク開始時に生成 (epoch+短縮hash)、`artifacts/.task_id` に保持。

### Linear連携 (v1.x ロードマップ)

- `/pev <linear-issue-url>` でLinear IssueからGoal/Constraints/AC を抽出
- `verify.json` (PASS) をLinear Issueにコメント自動投稿
- Linear MCP server (`mcp__plugin_linear_linear__*`) を利用
- v1.0ではartifacts/はローカルのみ

---

## 10. Dual Review (--strict) の詳細

v2.0 で reviewer mode を 4 種に拡張:

| Mode | Reviewer A | Reviewer B | 用途 |
|---|---|---|---|
| `claude-only` (default) | claude verifier 単独 | (なし) | 通常タスク |
| `dual-claude` | opus (xhigh) | sonnet (high) | `--strict` 旧挙動 (v1.x default) |
| `dual-codex` (v2.0+) | opus (xhigh) | codex CLI (`codex exec --json`) | 真の external model diversity |
| `codex-only` (v2.0+) | (なし) | codex CLI 単独 | claude 不在 / cost 削減 path |

切替方法 (priority 高い順):

1. `/pev <task> --reviewer-mode=<mode>` (CLI flag)
2. `.claude/settings.local.json` の env `PEV_REVIEWER_MODE`
3. settings.json default (= `claude-only`)

独立性の担保 (mode 共通):

1. **並列起動** — 同一メッセージ内で 2 Agent tool call (Claude pair) または Agent + subprocess (Claude + codex) を同時送信
2. **Context isolation** — 互いの結果を見せない (codex はそもそも別 process なので OS レベル isolation)
3. **同一 rubric** — 同じ評価基準を両者に渡す
4. **Fresh agents each round** — 前ラウンドの記憶を持たない (codex も `--ephemeral` flag で session rollout を残さない)

### Codex CLI 統合 (v2.0+) の技術詳細

- CLI: `codex exec --json --output-schema <schema> -o <out.json> --ephemeral --sandbox workspace-write "<prompt>"`
- 認証 (2 path、 どちらでも可):
  - **(a) ChatGPT subscription** (推奨): `codex login` でブラウザ sign-in、 ChatGPT Plus/Pro/Team/Enterprise の subscription が前提、 API key 不要
  - **(b) API key**: `OPENAI_API_KEY` (codex v0.128+ の help が言及) または `CODEX_API_KEY` (v0.130+ public docs が言及)。 `printenv OPENAI_API_KEY | codex login --with-api-key` で codex 内部に取り込み
- timeout: `timeout ${PEV_CODEX_TIMEOUT:-300}s` で wrap (CLI 自体には timeout flag なし)
- output schema: `schemas/codex-reviewer-output.json` で reviewer JSON 構造を強制
- fallback: codex CLI 不在 / 未認証 (`codex login status` が "Not logged in") / timeout / non-zero exit → 自動で `dual-claude` に degrade、 `verify.json.fallback_reason` に記録 + warning

### model diversity の改善 (v1.x との差分)

- v1.x (claude-only / dual-claude): 同一モデルファミリーで blind spot を共有
- v2.0+ (dual-codex): 異 vendor (Anthropic + OpenAI) で training corpus + RLHF policy + tokenization の独立性、 blind spot 共有が低減
- 残る共通制約: 両者とも LLM ベースなので「LLM 全般の苦手分野」 (e.g., precise counting、 deep mathematical reasoning) は両者で同時に外しうる、 これは v2.x 範疇外

---

## 11. ロードマップ

| Version | スコープ | 完了基準 | Status |
|---|---|---|---|
| v0.1 | skeleton + 3 agents + /pev | minimal flowが動く | ✅ released |
| v0.2 | Gate A logic + task lifecycle + recap auto-append | permissionMode判定でGate A制御 | ✅ released |
| v0.3 | verifier Memory write + task_budget rewrite | 全agentでmemory write、task_budget honest spec | ✅ released |
| v0.4 | pev-dual-review (Claude single, model alias) | A=Opus / B=Sonnet 並列実行 | ✅ released |
| v0.5 | pev-team-conventions auto-injection | チーム規約自動注入 | ✅ released |
| v0.6 | Gate A enforcement (3層防御) | planner が Gate A を bypass しない | ✅ released |
| **v1.0** | ロールアウト準備完了 (ONBOARDING / ROLLOUT-CHECKLIST / FEEDBACK-TEMPLATE) | **3 signals 収集 (Issue #7 open)** | ✅ released, signals pending |
| v1.1 | OSS readiness (LICENSE / SECURITY / templates / public flip) | private → public 完了 | ✅ released |
| **v1.2** | **pev-linear-sync skill** | Linear Issue ↔ artifacts 双方向同期 | ✅ released |
| **v1.3** | **Linear integration hardening** | 28 dog food findings 反映、 linear-project-tracker 新設 | ✅ released |
| **v1.4** | **E2E verification (Playwright CLI)** | pev-e2e-verify + pev-bootstrap-playwright skills、 verifier に dispatch logic | ✅ released |
| **v1.5** | **QA technique integration** | pev-test-design skill (6 QA techniques) + error-patterns catalog + qa-checklists templates | ✅ released |
| **v1.6** | **v1.4+v1.5 dog food findings reflection** | qa_derived_checks schema 拡張 (evidence_type) / mirror compression / handoff doc / --force-auto flag / Playwright DRY pattern | ✅ released |
| **v1.7** | **CLAUDE.md re-targeting (developer-oriented)** | repo root CLAUDE.md を開発者向け暗黙知集に書き換え、 plugin user 向けは README へ集約 | ✅ released |
| v1.7.1 | dev-only doc を `guide/` に集約 | docs/ + CHECKLIST/ROLLOUT/FEEDBACK を guide/ へ。 cross-reference 更新 | ✅ released |
| v1.8 | v1.3 + v1.7.1 dog food findings reflection (9 件) | linear-project-workflow 4件 (#13/#14/#15/#18) / agents 3件 (#16/#20/#21) / `--expect-fail` flag (#17) / team-conventions Lint・Typecheck 明示 (#19) | ✅ released |
| v1.9 | `/pev-init` project bootstrap command | pev-bootstrap-project skill + 言語検知 (Node/Python/Go/Rust) + team-conventions auto-populate + .gitignore append + interactive prompts + dry-run mode | ✅ released |
| **v2.0** | **External reviewer (OpenAI Codex CLI) integration** | pev-bootstrap-codex / pev-external-reviewer skill + reviewer mode 4 種 (claude-only/dual-claude/dual-codex/codex-only) + codex-reviewer-output schema + fallback path | ✅ released |
| **v2.1** | **empirical-prompt-tuning skill 取り込み** | mizchi/skills の empirical-prompt-tuning を skills/empirical-prompt-tuning/ に導入、 skill-finder 削除 (上位互換) | ✅ released |
| **v2.1.1** | **Plugin Marketplace 配布対応** | `.claude-plugin/marketplace.json` 追加、 plugin.json version 同期、 release procedure 更新 | (current) |
| v2.2+ | Gemini CLI 対応 / model 自由切替 (planner/executor も外部 model 可) | (TBD) | Issue #9 の continuation |

---

## 12. 設計判断ログ (ADR-like)

### ADR-001: なぜ3-phase固定か
plan/execute/verify を強制することで、Opus 4.7のliteral instruction-followingに対し、明示的なフェーズ分割が自然なscaffoldingになる。「考えて、書いて、確かめる」の標準化。

### ADR-002: なぜ外部CLI依存をやめたか
ECCの santa-loop は codex/gemini に依存していたが、社内ツールチェーンの統一が難しい。Claude単独 model alias 方式で model diversity を「弱く」確保し、依存ゼロを取る。v2.0で MCP経由の選択肢を残す。

### ADR-003: なぜ artifacts/ を gitignore にしたか
タスク固有の中間生成物として扱う。Linear連携 (v1.x) でplan/verifyを別管理する想定なので、リポジトリを汚さない。

### ADR-004: なぜ並列executor上限を3にしたか
- 4以上: ファイル衝突確率が指数的に増える
- 2以下: 並列化のメリットが薄い
- 3: 経験則的に独立タスクの平均粒度に合う

### ADR-005: なぜ Stop hookで verify自動起動なのか
"verify before returning" を planner/executor の prompt に書くと、4.7ではそれ自体が冗長な scaffolding になる。hookで強制すれば prompt は綺麗なまま。

### ADR-006: なぜ v2.0 で MCP server ではなく codex CLI subprocess を選んだか

ADR-002 では「v2.0 で MCP 経由の選択肢を残す」 と書いたが、 実装時に MCP server (codex) は public spec が未成熟だった一方、 `codex exec --json --output-schema` で **structured JSON output が公式 sanctioned** されている。 subprocess + JSON schema 強制で:

- **依存性が軽い**: MCP server を Claude Code に常駐させず、 verify 時のみ on-demand 起動
- **isolation が強い**: OS process boundary で context isolation が自然 (MCP 同居だと shared client state あり)
- **schema による型保証**: `--output-schema` で reviewer JSON 構造を強制、 merge logic 側の parse 失敗リスクが激減
- **fallback path が単純**: 子 process の non-zero exit / timeout で自動 degrade、 MCP の handshake 失敗より error mode が少ない

trade-off:

- 起動 latency: subprocess は 1-3 秒、 MCP 常駐の方が速い。 ただし verify は LLM 推論で 30-300 秒かかるので相対的に無視できる
- model 切替の自由度: subprocess は `--model` flag や `codex exec resume` でセッション再開可能、 MCP より細粒度
- Gemini / 他 vendor 拡張: v2.1+ で `pev-external-reviewer` skill を別 vendor CLI に拡張する path が同じ pattern で書ける (subprocess + JSON schema)

### ADR-007: なぜ Reviewer A は Claude のまま固定なのか

v2.0 で Reviewer B を codex に切替できるようにしたが、 Reviewer A は **opus 固定** とした:

- planner (opus) が plan.md を書いた直後の verify phase で、 同じ opus が再度 verify することは「自分の plan を自分で検証」 では**ない** (verifier は plan.md + diff + AC を独立に読み直すだけ、 planner session の memory なし)
- 一方、 codex を Reviewer A に置くと plan.md の理解と diff の評価で **codex 自身の plan 理解** が必要になり、 plan↔verify 間の rubric 整合性が崩れる可能性
- v2.x 範疇では Reviewer A=claude (plan-aware) / Reviewer B=codex (fresh perspective) の **役割分離** を採用、 v3.x で codex planner も検討
