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
│   └── 4.7-native.md
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

---

## 8. Commands

| Command | 説明 |
|---|---|
| `/pev <task>` | フルpipeline。Plan → Execute → Verify を順に実行、Gate A/B で停止判定 |
| `/pev-plan <task>` | Plan のみ実行、`artifacts/plan.md` 出力 |
| `/pev-execute` | 既存 plan.md を読んで実装 |
| `/pev-verify` | 検証のみ実行 |
| `/pev-status` | 現在のphase / artifacts一覧 / 残り task budget |

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

Reviewer 2人とも Claude (model alias で多様性):

| Role | model | effort |
|---|---|---|
| Reviewer A | opus (claude-opus-4-7) | xhigh |
| Reviewer B | sonnet (claude-sonnet-4-6) | high |

独立性の担保:
1. **並列起動** — 同一メッセージ内で2 Agent tool callを同時送信
2. **Context isolation** — 互いの結果を見せない
3. **同一rubric** — 同じ評価基準
4. **Fresh agents each round** — 前ラウンドの記憶を持たない

**model diversityの限界の明記**: 同一モデルファミリーなのでblind spotを完全に消せない。許容トレードオフ。v2.0で MCP server経由の外部model対応を検討。

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
| v2.0 | 外部model対応 (MCP server経由) | OpenAI/Gemini MCP統合 | Issue #9 |

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
