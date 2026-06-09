# pev-harness Specification

Claude Opus 4.8 時代のコーディングハーネス。 **v3.0 で「(Triage →) Plan → Execute → Verify」 pipeline に再設計**。 v2.x までの 3-phase 固定から、 Plan を on-demand 化 + 質問判定強化 + F1 Defensive default の scope 限定 で「user の頭の中の spec を引き出す」 を主要 value に再定義。 4.X の native 機能 (xhigh effort, adaptive thinking, task budget, auto mode) を前提として設計する。

- **対象**: チーム内共有
- **配布**: Claude Code plugin単独
- **設計哲学**: ミニマル削ぎ落とし。 v3.0 時点で core skill 8 個、 agent 4 個 (triage / planner / executor / verifier)、 command 5 個、 hook 3 個のみ。

---

## 1. 設計原則 (P1-P5)

| # | 原則 | 反対パターン |
|---|---|---|
| **P1** | **Single source of truth** — 1 phaseに1 agent / 1 skill。重複させない | "continuous-learning" と "continuous-learning-v2" の並立 |
| **P2** | **4.X-native** — xhigh / adaptive thinking / task budget / auto modeを前提 | 4.6以前のscaffolding (`"step by step"` 等) を **prompt 本文** に書く |
| **P3** | **No backwards compat** — レガシー考慮ゼロ。Claude Code v2.1.156+ 必須 (Opus 4.8 pin + <2.1.156 の tool-use 400 bug 回避、 一次ソース確定) | 新旧両対応の分岐コード |
| **P4** | **Convention over configuration** — settings.jsonデフォルトで動く | 環境変数を10個要求するhook |
| **P5** | **External verification mechanism** — 検証は agent prompt の自己宣言ではなく、 外部仕組み (hook / skill / test runner) で担保する | "verify before returning" を agent prompt に書く |

### 1次情報根拠 (v2.1.2 追記)

各原則の Anthropic 公式 1次情報 (B1=[blog 2026-04-16](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code), B2=[what's new 4.7](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7), B3=[task budgets](https://platform.claude.com/docs/en/build-with-claude/task-budgets), B4=Boris/Cat Wu 投稿) との対応:

| 原則 | 1次情報根拠 | 補足 |
|---|---|---|
| P1 | 直接的記述なし、 PEV-harness 独自原則 | B1 の "more judicious about when to delegate to subagents" と矛盾しない |
| P2 | xhigh (B1) / adaptive thinking (B1) / task budget (B3 ※Claude Code 非サポート) / auto mode (B4 Tip 1) | 「step-by-step を一切書かない」は **prompt 本文限定の社内規約**。 B1 は thinking hint としての "Think carefully and step-by-step" を実は許容している ([rules/native-prompting.md](./rules/native-prompting.md) §公式 1次情報との関係 参照) |
| P3 | **一次ソースで確定** ([errors](https://code.claude.com/docs/en/errors)): 「Opus 4.8 needs v2.1.154 or later」、 ただし「Versions before v2.1.156 can trigger [400] error during normal tool use」 (CHANGELOG v2.1.156 で fix)。 Dynamic Workflows も v2.1.154+ ([workflows](https://code.claude.com/docs/en/workflows)) | 2 段: **v2.1.154** = Opus 4.8 認識最小 / **v2.1.156** = tool-use 健全最小。 tool-heavy な harness の floor は **v2.1.156** (v3.7.2、 v3.6.0 までは 社内検証値 v2.1.111) |
| P4 | 直接的記述なし、 汎用設計原則 | — |
| P5 | B1 「Include tests, screenshots, or expected outputs so Claude can check itself」、 B4 Tip 6 (`/go` skill) | 「hook で強制」は PEV-harness の実装選択 (ADR-005)、 原則レベルでは「外部 verification mechanism」 |

> **(v3.6.0 追記) Opus 4.8 での再評価**: B1-B5 は 4.7 期に確立した根拠。 Opus 4.8 リリース時の公式 prompting guidance ([What's new in Claude Opus 4.8](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8) / [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)) を調査した結果、 P2 anti-scaffolding の核は 4.8 でも支持され (literal-following 強化でむしろ重要度増)、 ただし scoped self-verify は公式推奨のため [rules/native-prompting.md](./rules/native-prompting.md) に許容例外を追記した。 effort default は 4.7=xhigh → 4.8=high に低下したが、 settings.json は xhigh を明示 pin するため挙動は不変。

---

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│              /pev <task>  または 自然言語入力                │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
        ┌─────────────────────────────────────┐
        │  PHASE 1: PLAN                       │
        │  agent: planner   model: opus-4-8    │
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
│   ├── native-prompting.md
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

### Phase 0: Triage (v3.0+)

agent `agents/triage.md`:

- `model: sonnet`, `effort: low` — 軽量 router、 1 turn 以内で判定
- tools: Read / Glob / Bash
- 入力: user の task description + cwd context (既存 codebase / spec doc / team-conventions.md の有無)
- 動作: LLM 判断で「Plan 必要 (= 曖昧 spec / zero context / UI 拡張要素未明示) か」 を decide
- 出力: `artifacts/triage.json` (= decision + reasoning + context_signals + ambiguity_signals)
- **Defensive default**: 判断に自信がない場合は `plan_required` (= 過剰 skip を避ける)
- Flag override: `--with-plan` (= 必ず Plan 起動、 v2.x 互換) / `--no-plan` (= 必ず Plan skip)

### Phase 1: Plan (v3.0+ on-demand)

agent `agents/planner.md`：
- `model: opus`, `effort: xhigh` — 公式 B1 推奨 (「intelligence-sensitive tasks like designing APIs and schemas, migrating legacy code」 が xhigh の sweet spot)
- tools: Read / Grep / Glob / Write
- **v3.0+ 起動条件**: Triage agent が `plan_required` と判定した場合のみ。 `--with-plan` flag でも強制起動可能
- 入力契約: **Goal / Constraints / Acceptance Criteria** (必須)、関連ファイルパス (任意) — 公式 Cat Wu Tip 2 ([B5](https://x.com/_catwu/status/2044808533905178822)) 「Give Claude Code your full task context upfront」 の直接実装
- **v3.0+ 質問返し**: 入力不足 / UI 拡張要素未明示 / 表示 detail 未明示 / 拡張 feature 有無未明示 の場合、 plan.md 冒頭に「## 確認質問」 section を作って **必ず質問**。 「pattern 踏襲」 prompt 指示があっても dialog / 削除方式 / 状態遷移細部 / 拡張 feature 有無 / error UX は質問必須 (v3.0.1+)
- **v3.0+ F1 Defensive default**: 適用領域を security / data integrity / 状態不整合 に **限定** (= v2.1.6 で全領域に適用していたものを refine)、 UI / 表示 / nice-to-have は質問必須
- 出力: `artifacts/plan.md`
- Task budget: 50k tokens (`pev-task-budget` skill で指定、 ただし **Claude Code surface では公式非サポート**、 prompt-level hint のみ。 [B3](https://platform.claude.com/docs/en/build-with-claude/task-budgets) 引用は当該 skill 参照)

### Phase 2: Execute

agent `agents/executor.md`：
- `model: sonnet`, `effort: high` — 公式 B1 「Balances intelligence and cost. Choose high if you're running concurrent sessions」 と一致
- tools: Read / Edit / Write / Bash / Grep / Glob
- **v3.0+ 2 つの mode**:
  - **Mode A (plan ベース)**: `artifacts/plan.md` の File-level changes に従って実装 (= v2.x までの挙動)
  - **Mode B (plan-less、 v3.0+ 新規)**: Triage が `plan_skip` 判定した場合、 plan.md なしで user prompt + cwd context (team-conventions.md / 既存実装) を直接読んで実装。 不明確な点に直面したら推測せず停止
- 並列化: 公式 B1 「Spawn multiple subagents in the same turn when fanning out across items or reading multiple files」 に準拠。 **default は直列 1**、 fan-out / independent items が plan.md に明示されている時のみ並列 (上限 3 = `PEV_PARALLEL_EXECUTOR_MAX`、 ADR-004)
- DRY self-review (v2.1.6+): 同関数の再実装 / loop pattern 重複 / dead import / dead branch / dead comment を実装直後に self-check
- Subagent memory: `~/.claude/pev/{task_id}/executor-{N}.md`
- **Codex delegation mode (v3.5.0+)**: `PEV_EXECUTOR_MODE=codex` の時、 実 file 編集を OpenAI Codex CLI に委譲。 executor agent は wrapper として残り、 `execute.log` / DRY self-review / judgment trace / Mode B Self-Clarify を担当。 codex 未 setup / 未認証 / timeout 時は Claude native 実装に自動 degrade。 Mode A/B (= 入力軸) と直交し 4 通り成立。 詳細は `skills/pev-external-executor/SKILL.md` + ADR-009。 **v3.7.0 で本 mode を default 化** (settings.json `PEV_EXECUTOR_MODE` default = `codex`、 未 setup は claude degrade)

### Phase 3: Verify

agent `agents/verifier.md`：
- `model: sonnet`, `effort: xhigh` — 公式 B1 「xhigh: The best setting for most coding and agentic uses」 と一致
- tools: Read / Bash / Grep
- 実行手順 (hard-coded、変更不可) — ADR-008 で「Verifier は engineer ではなく CI runner」 として正当化:
  1. `git diff` で変更取得
  2. plan.md の Verification strategy を実行
  3. Acceptance Criteria を1つずつ ✅/❌ チェック
  4. `artifacts/verify.json` に書き出し
  5. FAIL あれば planner に diff + 失敗内容を渡してリトライ (**最大3回 = 経験則、 1次情報根拠なし**)
- `--strict` モード: `pev-dual-review` skill が起動し、Reviewer A=Opus 4.8、Reviewer B=Sonnet 4.6 を並列実行

### Phase Gates

| Gate | 位置 | 挙動 |
|---|---|---|
| **L** | Plan → Gate A (= `.linear-config.yml` 存在時のみ、 v3.3.0+、 v3.3.1 で配置修正) | Linear issue-first。 実装前に Linear issue を作成し、 Linear 発行 branch を checkout。 **Gate A の前** に置く (v3.3.0 は Gate A の後に置いて default mode で dead path だった、 F_v15_1)。 不在なら skip |
| **A** | Gate L → Execute (= Plan が起動された場合のみ) | `permissionMode` 判定。auto時スキップ、default時停止、plan時終了。 v3.0+ では Triage が `plan_skip` した場合 Gate A 自体を skip して直接 Execute |
| **B** | Execute → Verify | Stop hookが自動でverifier起動 |
| **Retry** | Verify FAIL時 | plan.md と diff を planner に戻す、最大3回 (= plan.md がない Mode B では Triage に戻す or 単発再 Execute、 v3.1+ で詳細詰め) |

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

`settings.json` (v2.1.2 で 公式 schema 準拠化):

```json
{
  "model": "claude-opus-4-8",
  "effortLevel": "xhigh",
  "permissions": {
    "defaultMode": "default"
  },
  "env": {
    "PEV_TASK_BUDGET": "100000",
    "PEV_MAX_RETRIES": "3",
    "PEV_STRICT_MODE": "false",
    "PEV_PARALLEL_EXECUTOR_MAX": "3"
  }
}
```

- `permissions.defaultMode` のデフォルトは安全側の `"default"` (v2.1.1 まで top-level `"permissionMode"` だったが、 公式 [settings.md](https://code.claude.com/docs/en/settings.md) で正規 key ではなかったため v2.1.2 で修正)
- Auto Mode利用者は Shift+Tab でセッション内切替、または `.claude/settings.local.json` で個別上書き
- B1 「If you're upgrading to the new model, we recommend experimenting with effort rather than just porting over an old setting」 を踏まえ、 session 内で `/effort` 切替も推奨 (default xhigh は出発点)
- skill auto-invocation 抑止: top-level の独自 field ではなく、 各 SKILL.md の `disable-model-invocation: true` / `user-invocable: false` で個別制御 (v2.1.2 から)

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
| **pev-external-reviewer** | 外部 LLM CLI (Codex) を Reviewer B として subprocess invoke (v2.0+) | `PEV_REVIEWER_MODE` が dual-codex / codex-only の時 |
| **pev-external-executor** | 外部 LLM CLI (Codex) に Execute phase の実 file 編集を委譲、 executor agent は wrapper (v3.5.0+) | `PEV_EXECUTOR_MODE=codex` の時 |
| **pev-team-conventions** | `team-conventions.md` を読み込み planner/executor に注入 | Plan/Execute起動時 |
| **pev-bootstrap-playwright** | Playwright + agents の one-time setup (v1.4+) | `/pev-init-e2e` / E2E preflight 未setup |
| **pev-bootstrap-project** | project 全体の初期 setup (team-conventions / .gitignore / 言語検知) (v1.9+) | `/pev-init` |
| **pev-bootstrap-codex** | Codex CLI を reviewer + executor として導入する one-time setup (v2.0+ / v3.5.0+) | `/pev-init-codex` / codex preflight 未setup |
| **empirical-prompt-tuning** | skill / slash command / プロンプトを subagent で実走させ自己申告 + 指示側メトリクスで反復改善 (v2.1+) | skill / プロンプト新規作成・大幅改訂直後 |
| **pev-linear-sync** | Linear Issue ↔ PEV pipeline の双方向 sync (inbound / issue-first / outbound success / outbound fail の 4 direction、 v3.3.0+) | Linear URL 起動 / `.linear-config.yml` 存在時 (Gate L) / verifier 完了時 |
| **linear-project-workflow** | Linear Project の規約 / template (5 section: Who/What/Why/完了条件/スコープ外) + title 命名規則 (Who wants What, Why、 v3.4.0+) | project の Read / Write / Update 時 |
| **linear-issue-workflow** | Linear Issue の規約 / template (6 section: 概要/背景・現状/やること/やらないこと/完了条件/参考情報) + title 命名規則 (How、 v3.4.0+) | issue の Read / Write / Update 時、 pev-linear-sync から呼ばれる |
| **linear-project-tracker** | Linear Project の進捗監視と完了判定 | outbound success 後の after-hook |

---

## 8. Commands

| Command | 説明 |
|---|---|
| `/pev <task>` | フルpipeline (v3.0+)。 Triage → (Plan?) → Execute → Verify、 Gate A/B で停止判定 |
| `/pev <task> --with-plan` | Triage を skip して必ず Plan を起動 (= v2.x 互換挙動) |
| `/pev <task> --no-plan` | Triage を skip して必ず Plan-less Execute (= 最短 path) |
| `/pev <task> --executor-mode=codex` | Execute phase の実 file 編集を OpenAI Codex CLI に委譲 (v3.5.0+)、 executor agent は wrapper |
| `/pev-plan <task>` | Plan のみ実行、`artifacts/plan.md` 出力 |
| `/pev-execute` | 既存 plan.md があれば読んで実装、 なければ task description ベースで Mode B 実装 (v3.0+) |
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
├── triage.json                  # Phase 0 出力 (v3.0+、 plan_required / plan_skip 判定)
├── plan.md                      # Phase 1 出力 (Plan 起動時のみ)
├── execute.log                  # Phase 2 ログ
├── verify.json                  # Phase 3 結果
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

### Codex executor 統合 (v3.5.0+)

v2.0 の codex reviewer 統合に対し、 v3.5.0 で codex を **Execute phase の実装エンジン** としても使えるようにした (`PEV_EXECUTOR_MODE=codex` / `--executor-mode=codex`)。 reviewer mode (= model diversity 仮説) とは目的が異なり、 「codex を実装に使いたい team / path への対応」 が主眼。

- CLI: `codex exec --json --output-schema schemas/codex-executor-output.json -o <out.json> --ephemeral --sandbox workspace-write --skip-git-repo-check "<prompt>"`
- 認証 / install / fallback の基本機構は reviewer と共通 (= `pev-bootstrap-codex` で reviewer + executor 両方を 1 回 setup)
- **責務分離 (ADR-009)**: codex は raw な file 編集のみ。 `execute.log` authoring / DRY self-review / judgment trace / Mode B Self-Clarify は Claude executor agent (wrapper) が担当
- timeout: `PEV_CODEX_EXEC_TIMEOUT` default 600 (reviewer の `PEV_CODEX_TIMEOUT` 300 の倍、 実装は review より時間を要するため)
- fallback: codex CLI 不在 / 未認証 / timeout / non-zero exit / schema 違反 → Claude native 実装に degrade、 `execute.log` の `fallback_reason` に記録
- `--parallel` 非対応: codex は 1 invocation で複数 file を編集できるため、 並列 subprocess 化はしない

詳細プロトコルは `skills/pev-external-executor/SKILL.md`、 codex 出力 schema は `schemas/codex-executor-output.json`。

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
| v2.1.1 | Plugin Marketplace 配布対応 | `.claude-plugin/marketplace.json` 追加、 plugin.json version 同期、 release procedure 更新 | ✅ released |
| **v2.1.2** | **Anthropic 公式 best practice 適合性 fix** | `marketplace.json` source `"."` → `"./"` (install 失敗修正) / PreToolUse hook stdin JSON 化 (destructive guard 復活) / settings.json `permissions.defaultMode` 化 / 3 bootstrap skill に `disable-model-invocation` | ✅ released |
| **v2.1.3** | **Anthropic 公式 skill vendoring (skill-creator + frontend-design)** | `anthropics/skills` から 2 件を `skills/` に完全 vendoring (LICENSE.txt 同梱) / CI forbidden-phrase + markdownlint で vendored exclude / `rules/4.7-native.md` に vendoring 例外節追加 | ✅ released |
| **v2.1.4** | **連携 plugin prerequisites 明示 (Linear MCP / Playwright / Codex CLI)** | `README.md` Optional integrations + `ONBOARDING.md` §1.5 連携 plugin + `ROLLOUT-CHECKLIST.md` Pre-rollout 個人項目に Linear MCP install (`linear@claude-plugins-official` + OAuth) / Codex CLI auth 手順追記 | ✅ released |
| **v2.1.5** | **Project scope install 手順 (team 共有)** | `ONBOARDING.md` §1.2 新規 (`.claude/settings.json` `extraKnownMarketplaces` + `enabledPlugins` Pattern P1 / `--scope project` Pattern P2 / scope 3 種比較) + `README.md` Quick start 3 セクション化 (A user / B project / C `--plugin-dir`) | ✅ released |
| **v2.1.6** | **harness-effect-v1 dog food findings reflection** | `experiments/harness-effect-v1/` 新設 (4 軸比較 framework) / planner に Defensive default 原則 / executor に DRY self-review / extract-metrics-v2.py で phase 別 breakdown | ✅ released |
| **v3.0** | **value proposition 再定義: 「user の頭の中の spec を引き出す」** | `agents/triage.md` 新設 (Plan 必要性判定 router) / Plan を on-demand 化 / planner に「## 確認質問」 protocol / F1 scope 限定 (security / data integrity / 状態不整合 のみ、 UI 拡張は質問必須) / executor の plan-less mode 対応 / experiments/harness-effect-v1-v4 で根拠提示 | ✅ released |
| **v3.0.1** | **harness-effect-v5 dog food findings reflection (F_v5_1)** | planner に「pattern 踏襲指示が来ても dialog / 削除方式 / 状態遷移細部 / 拡張 feature / error UX は質問必須」 directive 追加 / experiments/harness-effect-v5/ で再現性検証 (軸 1-4 で +6 で勝利) | ✅ released |
| **v3.0.2** | **ドキュメント align** | CLAUDE.md / SPEC.md / README / ONBOARDING / rules / skills / examples / guide の全 active doc を v3.0 reflect、 歴史 doc には disclaimer note 追加 | ✅ released |
| **v3.0.3** | **F_v6_1 patch (DOM container/text 分離)** | planner.md に「DOM container 内に新規 element 追加時は text 代入が子 element を破壊しない構造を AC で明示」 directive 追加。 harness-effect-v6 で textContent bug の事前明示用、 harness-effect-v7 で Mode B 初実証 | ✅ released |
| **v3.0.4** | **F_v8_1/2/3 patch (Triage 強化)** | triage.md schema 厳守 / `task_infeasible` 判定追加 / 「pattern 踏襲」 指示でも conservative (= F_v5_1 との 2 段階防御)。 harness-effect-v8 multi-task tuning で検出 | ✅ released |
| **v3.0.5** | **F_v10_1 patch (commands/pev.md と task_infeasible 統合)** | commands/pev.md に task_infeasible 受領 logic + 「main は必ず triage agent invoke、 自走判定禁止」 directive 追加。 harness-effect-v10 で F_v8_1 が agent prompt だけでは不発動と判明 | ✅ released |
| **v3.1.0** | **bin/pev-interactive helper script 新設** | claude を stream-json input mode で wrap する helper、 質問返し channel を 1 cmd で確保。 F_v2_1 / F_v5_2 対応 | ✅ released |
| **v3.2.0** | **Mode B Self-Clarify Protocol** | executor.md に Mode B 不明確時の停止 + clarification.md format + 5 trigger 明示。 commands/pev-execute.md に受領 logic + `--use-defaults` flag | ✅ released |
| **v3.2.1** | **F_v13_2 hotfix (Mode B Self-Clarify hardening)** | trigger を「MUST stop」 hard-fail tone に / 自走 OK case を 3 条件すべて該当に厳格化 / execute.log に self-clarify check 記録必須化 | ✅ released |
| **v3.3.0** | **Linear issue-first workflow** | pev-linear-sync に Direction 1.5 (issue 作成 + branch checkout) / commands/pev.md に Gate L。 `.linear-config.yml` 存在時、 実装前に必ず Linear issue を立てて Linear 発行 branch で実装 | ✅ released |
| **v3.3.1** | **F_v15_1 hotfix (Gate L 配置修正)** | Gate L を Gate A の後 (Step 3.5) → 前 (Step 2.5) に re-order。 v3.3.0 では default mode で Gate A 停止により Gate L が dead path だった | ✅ released |
| **v3.3.2** | **F_v16_1 docs patch (subprocess Linear MCP)** | CLAUDE.md §6/§3.3 に「dog food subprocess は親の Linear MCP 認証を継承しない、 `--mcp-config` で明示渡し」 を追記。 harness-effect-v16 で判明 | ✅ released |
| **v3.3.3** | **F_v17_2/3 patch (Gate L degraded 条件 + gitBranchName pin)** | pev-linear-sync に branch field=`gitBranchName` (save_issue 戻り値) を pin / Gate L degraded mode 条件に「configured but unauthed」 「headless OAuth 不可」 を追加。 harness-effect-v17 で実 Linear write path を ground-truth 検証 | ✅ released |
| **v3.4.0** | **Linear issue / project の命名規則 + template 正式化** | `linear-issue-workflow` skill 新設 (gap 解消、 命名規則=How、 template 6 section) / `linear-project-workflow` に title 命名規則 (Who wants What, Why) 追加 / pev-linear-sync Direction 1.5 を template 整合 | ✅ released |
| **v3.5.0** | **Codex executor mode (実装を Codex CLI に委譲)** | `pev-external-executor` skill 新設 + `codex-executor-output` schema / `executor.md` に Codex delegation mode (wrapper flow) / `--executor-mode` flag + `PEV_EXECUTOR_MODE` env / `pev-bootstrap-codex` を reviewer + executor 両用に拡張 / ADR-009 | ✅ released |
| **v3.6.0** | **Opus 4.8 native 化** | settings model pin / manifest を 4.8 へ / `rules/4.7-native.md` → `native-prompting.md` (version 中立名) + 設計原則 P2 `4.X-native` / scoped self-verify 例外明文化 / version 文字列の 4.8 化。 5 角度 Web リサーチ + 影響マトリクス根拠 | ✅ released |
| **v3.7.0** | **Execute phase default を codex に正式化** | settings.json PEV_EXECUTOR_MODE default = codex / pev.md fallback (:-codex) / 関連 doc (pev.md / pev-execute.md / executor.md / pev-external-executor / SPEC §4) + ONBOARDING データ送信ポリシー追記。 codex 未 setup は claude に自動 degrade | ✅ released |
| **v3.7.1** | **Claude Code 必須 version を v2.1.154 に bump** | 一次裏取り (code.claude.com/docs/en/errors 「Opus 4.8 needs v2.1.154 or later」 + workflows doc 「require v2.1.154 or later」) で確定、 Opus 4.8 pin と compat の不整合を解消。 plugin.json compat / README badge / ONBOARDING / ROLLOUT / CLAUDE.md / SPEC P3 注記を更新 | ✅ released |
| **v3.7.2** | **必須 version を v2.1.156 に格上げ** | <2.1.156 + Opus 4.8 は通常 tool 使用で 400 (errors page 「Versions before v2.1.156 can trigger this error during normal tool use」、 CHANGELOG v2.1.156 で fix)。 tool-heavy な harness の実 floor として compat / badge / docs を v2.1.156 へ | ✅ released |
| **v3.7.3** | **pev-focus-mode skill 正確性補正** | focus mode / `/focus` は現存・現役と一次ソース確定 (commands reference + CHANGELOG v2.1.118〜152)。 skill に fullscreen 専用 caveat + `viewMode` 設定を追記、 version 表記中立化。 v3.6.0 の「現存性未確認」 false negative を解消 | ✅ released |
| **v4.0.0** | **公式 primitive 再配置 (`/goal` 駆動 + grill-me 統合)** | Retry Gate を Claude Code 公式 `/goal` primitive に委譲 (機構は借り、 verifier の別 Task dispatch = 独立検証は pev が握る、 F_v18_5)。 planner 質問返しに grill-me 統合 (推奨答え必須 + コード探索優先)。 `/goal` unavailable は legacy retry_count に degrade。 harness-effect-v18 PoC (positive + negative) で実機検証、 設計は `experiments/v4.0-design.md` | ✅ released |
| **v4.1.0** | **`/goal` 前提化 (legacy retry_count 撤去)** | v4.0 の自前 retry 自走ループを削除し retry 駆動を `/goal` に一本化。 Step 7 を「`/goal` set + retry を回さない例外」 の 2 構造に簡素化、 `--no-goal-loop` flag 削除。 必須 version v2.1.156 が `/goal` floor (v2.1.139) を上回るため全 user 利用可、 version degrade 不要。 GGV 体制の orchestration 純減 | ✅ released |
| v3.8+ | verifier 側で self-clarify 漏れ検出 (2 段階防御) / Mode B verify protocol skill 化 / Gemini CLI 対応 (reviewer + executor) | (TBD) | — |

---

## 12. 設計判断ログ (ADR-like)

### ADR-001: なぜ 3-phase 固定 → Plan on-demand (v3.0) に変更したか

(v2.1.2 で 1次情報根拠を補強、 v3.0 で再評価)

公式の 4.7 best practice ([B1](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code)) は「最初のターンで意図・制約・受け入れ基準を全部入れる」「one-shot completion を狙う」 という委譲モデルを推奨。 [B5](https://x.com/_catwu/status/2044808533905178822) (Cat Wu Tip 2) は同じ趣旨で「Give Claude Code your full task context upfront: goal, constraints, acceptance criteria in the first turn」 と明言。 PEV-harness は v2.x までこれを以下の 3 段階で実装してきた:

- **Phase 1 (Plan)**: B5 の入力契約 (Goal/Constraints/AC) を強制し、 Planner が完全な task brief を生成
- **Phase 2 (Execute)**: full-context brief を受けた executor が one-shot 実装 (B1 の delegation モデル直接実装)
- **Phase 3 (Verify)**: B1 「verification を与えよ」 を独立 phase として外部化、 B4 Tip 6 の `/go` skill を構造化した version

#### v3.0 での再評価

harness-effect-v1/v2/v3/v4 (= experiments/) の 4 件 dog food で、 3-phase 固定の以下の構造的問題が見えた:

- **明確 spec / 既存 codebase あり task で Plan が overkill** (= v1 タイ / v4 で no-harness 勝)
- **効率コスト 12-18x が回収されないケース** (= 既存 pattern からの推測で十分な task)
- **F1 Defensive default が minimal interpretation を生む** (= v4 で counter UI を Non-goal に倒す)

v3.0 でこれを以下に refine:

- **Phase 0 (Triage、 v3.0+ 新規)**: Plan 必要性を 1 turn で判定する軽量 router (sonnet/low)。 cwd context + prompt 曖昧度で `plan_required` / `plan_skip` を decide
- **Phase 1 (Plan、 on-demand)**: Triage が plan_required と判定した場合のみ起動。 起動時の質問返しは必須機能 (= UI 拡張 / 表示 detail / nice-to-have は推測せず質問)
- **Phase 2 (Execute)**: Mode A (plan ベース) と Mode B (plan-less、 task description + cwd context 直接) の 2 mode 対応
- **Phase 3 (Verify)**: 変更なし

これにより B1 の「engineer to delegate to」 原則を保ちつつ、 「真に Plan が必要な task のみ Plan を払う」 経済性を追加。 v3.0 dog food (v3-dogfood + v5) で軸 1-4 で no-harness を +6〜+8 で逆転、 v3.0 の再現性確認済。

各 phase **内** では line-by-line 指導をせず、 phase 境界でのみ介入する。 これにより verifiability を担保する。

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

(v2.1.2 前文追記) **codex CLI 統合は 4.7-native best practice に直接根拠を持たない PEV-harness 独自拡張**。 [B1](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code) は「Spawn multiple subagents in the same turn when fanning out across items」 で独立 subagent 並列起動を許容しているため、 dual-review の発想自体は公式と整合するが、 「外部 vendor CLI (OpenAI Codex) を Reviewer B に据える」 model diversity 仮説は社内独自の判断。 v1.x dual-claude (同一 model family) より強い blind spot 軽減を期待しているが、 公式 1次情報での明示推奨はない。

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

### ADR-008: なぜ Verifier の実行手順だけ hard-coded か (v2.1.2 で新規)

通常 agent に対する逐次指示は [B1](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code) の「Treat Claude more like a capable engineer you're delegating to than a pair programmer you're guiding line by line」 と矛盾する。 しかし Verifier の作業は creative judgment ではなく **deterministic checklist** (build / typecheck / lint / test / AC 照合) なので、 hard-coded 化が許容される:

- **Verifier ≠ engineer**: 設計判断や trade-off の評価は plan-time に planner が済ませている。 verify-time は「plan で約束した checklist を pass/fail で answer する」 だけ
- **Verifier = CI runner**: GitHub Actions の workflow に「step by step で test を順に走らせろ」 と書いても CI engineer から文句は出ない。 verifier も同種の "deterministic agent"
- **rubric の安定性**: 手順が固定だと plan/verify 間の rubric 整合性 (ADR-007 と同根) が保てる、 verifier が「creative に手順を変える」 と reviewer mode 切替時に再現性が崩れる

別解釈として「verifier も engineer 扱いで delegation すべき」 案もありうるが、 dog food (v1.3/v1.6) では deterministic verifier の方が flaky 率が低かった (経験則、 1次情報根拠なし)。 v3.x で creative verifier の選択肢を別 mode として提供する案は roadmap 候補。

### ADR-009: なぜ codex executor mode で Claude executor を wrapper として残すか (v3.5.0 で新規)

v3.5.0 で codex を Execute phase の実装に使えるようにした際、 2 案があった: (a)「codex に Execute phase を完全に所有させる (= execute.log も codex が出力)」、 (b)「codex は raw 編集のみ、 Claude executor が wrapper として audit 成果物を authoring」。 (b) を採用:

- **`execute.log` / DRY self-review / judgment trace は後段 verifier が前提とする pipeline の audit 成果物**。 これらを codex に委ねると、 plan↔execute↔verify 間の rubric 整合 (ADR-007 で Reviewer A=claude 固定としたのと同じ論理) が崩れる
- **Mode B Self-Clarify の ambiguity gate** は plan-aware な Claude が持つ方が安全。 codex に委譲する前に Claude executor が pre-check することで、 不明確な task が codex に渡る前に停止できる
- codex は実装エンジンとして優秀なので **raw な file 編集** を担わせ、 wrapper の Claude が diff を読み直して DRY review / judgment trace / execute.log を書く

trade-off: codex の編集後に Claude が diff 全体を読むため、 完全委譲より token を消費する。 ただし Execute phase の LLM 推論コストに対し diff 読み直しは相対的に小さく、 audit 一貫性の価値が上回ると判断。 「codex 完全所有」 mode は roadmap 候補として残す。 この設計判断は user (= 開発者) との設計確認で確定 (v3.5.0 開発セッション)。
