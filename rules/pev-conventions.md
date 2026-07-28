# PEV Conventions

pev-harness を使う際の always-follow ガイドライン。すべての agent / skill / command の出力に適用される。

## 0. Gate respect (最重要、 v0.6 で追加、 v3.0 で Triage decision を追加)

PEV pipeline には以下の Gate / decision point がある:

- **Triage decision** (v3.0+、 Phase 0 出口): `.pev-artifacts/triage.json` の decision で「Plan 必要 / Plan skip」 を判定。 `--with-plan` / `--no-plan` flag で override 可能
- **Gate A** (Plan → Execute、 = Plan が起動された場合のみ): `permissionMode` で判定
- **Gate B** (Execute → Verify): Stop hook で promotion
- **Retry Gate** (Verify FAIL時): retry_count と PEV_MAX_RETRIES で判定

**Gate / Triage decision の判断は `commands/pev*.md` の役割であり、 agent の責務外**。

絶対遵守ルール:

- **triage agent (v3.0+)** は `.pev-artifacts/triage.json` を書いたら **そこで完全停止**。 planner / executor を起動しない。 後続 phase 進行は commands/pev.md の Step 1.5 が決める
- planner は plan.md を書いたら**そこで完全停止**。 executor を起動しない。 Phase 2進行はGate A が決める
- executor は変更を終えたら**そこで完全停止**。 verifier を起動しない。 Phase 3進行は Gate B (Stop hook) が決める
- verifier は verify.json を書いたら**そこで完全停止**。 retry 判断は Retry Gate に委ねる
- agent は「ユーザーが続行したいはずだ」「permissionMode=default だが意図を尊重する」 のような推論で **Phase boundary を越えてはならない**

このルールが破られた場合の症状: dog food で `permissionMode=default` なのにフルパイプラインが完走してしまう (v0.5 dog food で実観測)。 Phase boundary 違反は plugin の安全設計を無効化する。

## 1. 出力の最小性

- 不要な前置きを書かない ("以下に説明します"、"これからXをします" 等)
- 結論を先に書く、根拠は後
- リスト形式を優先、長い散文を避ける

## 2. 4.X-native (4.6スタイルの禁止事項)

以下のフレーズを **agent / skill のpromptに絶対に書かない**:

- "Let's think step by step"
- "think step by step"
- "step-by-step thinking"
- "Be thorough"
- "Be careful"
- "Double-check before returning"
- "Verify your output"
- "Self-check"
- "You are an expert ..."
- "You are a senior ..."

理由: Opus 4.X は adaptive thinking で自動的にこれらを実施する。明示すると逆に冗長な scaffolding として解釈され、出力品質が下がる。

詳細は `rules/native-prompting.md` 参照 (4.8 で許容される scoped self-verify の例外も同ファイル)。

## 3. ファイル境界

| ファイル | 書き手 | 読み手 |
|---|---|---|
| `.pev-artifacts/plan.md` | planner のみ | executor / verifier / human |
| `.pev-artifacts/execute.log` | executor | verifier / human |
| `.pev-artifacts/verify.json` | verifier | planner (retry時) / human |
| `.pev-artifacts/recap.log` | pev-recap skill | human / `/pev-status` |
| `~/.claude/pev/{task_id}/*` | 各agent (自分の.md のみ) | 他agent / 次セッション |

**他のagentの担当ファイルを変更しない**。

## 4. コミット境界

- 1つの論理的変更 = 1 commit
- agentは自動でコミットしない (人間が境界を決める)
- ただし executor は execute.log に「提案するコミットメッセージ」を記録する

## 5. 質問返しのタイミング

- 入力が曖昧な時 (Goal/Constraints/AC不足) → コードを読まずに即質問返し
- 設計分岐がある時 → 選択肢を提示
- 不可逆なオペレーション (破壊的変更、外部API呼び出し) を打つ前 → 確認

## 6. 言語ポリシー

- agent / skill / command のドキュメントは英日混在OK
- 出力 (plan.md, recap.log等) は user の言語に合わせる
- code内のコメントは原則書かない (rules/native-prompting.md参照)

## 7. Model tiering (v4.2.0+、 コスト規約。 v5.1.0 で orchestrator を Opus 5 に切替)

pev-harness は main session を **orchestrator (Opus 5)**、 各 phase を **委譲先 model** として階層化する。 orchestrator は上位単価 tier ($5/$25 per MTok、 Sonnet 5 の約 1.7 倍) で、 かつ会話 context が全 phase を跨いで累積するため、 **orchestrator が薄いこと** がコスト設計の前提になる。

| Layer | Model (settings / frontmatter) | Effort | 責務 |
|---|---|---|---|
| Orchestrator (main session) | `claude-opus-5` | high | Triage dispatch / Gate 判定 / `/goal` set / recap。 **実装・検証はしない** |
| Triage agent | `sonnet` (現行 Sonnet 5) | low | Plan 必要性の 1 turn 判定 |
| Planner agent | `opus` (現行 Opus 5) | xhigh | plan.md authoring (質問返し含む) |
| Executor agent | `sonnet` (default は codex 委譲) | high | code edits + execute.log |
| Verifier agent | `sonnet` | xhigh | build/test/AC 照合 + verify.json |

agent frontmatter の `opus` / `sonnet` alias は CLI が提供する最新の Opus / Sonnet に解決される (CLI v2.1.219+ で Claude 5 世代)。 pin が必要な環境 (provider 差異等) のみ full ID を明示する。

絶対遵守ルール:

- **orchestrator は実装 file を Read しない**。 artifacts (triage.json / plan.md / verify.json) の parse と cwd の存在確認まで。 src/ の中身を読む必要が生じたら、 それは phase agent の仕事 (= dispatch する)
- **orchestrator は code を書かない・test を走らせない**。 Execute は executor agent (or codex)、 検証は verifier agent へ。 orchestrator turn での「ついで実装」 はコスト invariant 違反 (上位単価 + 累積 context で heavy work を行うことになる)
- **agent frontmatter の model を orchestrator より上位の tier に上げない**。 phase の品質が必要なら effort を上げる (それでも足りない場合のみ ADR で議論)
- 目安: orchestrator の token 消費は task 全体の **15% 以下**。 超えるようなら orchestrator が phase の仕事を抱えている signal

背景と費用モデル: [experiments/v4.2-fable-orchestrator-cost.md](../experiments/v4.2-fable-orchestrator-cost.md) + [experiments/v5.1-opus5-retiering.md](../experiments/v5.1-opus5-retiering.md)。 **Fable 5 は opt-in tier**: 最上位の判断品質が必要な長大 pipeline では `.claude/settings.local.json` で `"model": "claude-fable-5"` に override できる (単価 2 倍 $10/$50、 30-day retention 必須のため ZDR org では不可)。 v4.2〜v5.0 の default だったが、 F_v19_10 (opus-tier orchestrator と等価) + Opus 5 リリースを受けて v5.1.0 で default を Opus 5 に変更した。

## 8. team-conventions.md の優先順位

team-conventions.md がプロジェクトに存在する場合、その内容が本ファイルより優先される。本ファイルは「pev-harness としての規約」、team-conventions.md は「プロジェクトの規約」。
