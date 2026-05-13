# PEV Conventions

pev-harness を使う際の always-follow ガイドライン。すべての agent / skill / command の出力に適用される。

## 0. Gate respect (最重要、 v0.6 で追加、 v3.0 で Triage decision を追加)

PEV pipeline には以下の Gate / decision point がある:

- **Triage decision** (v3.0+、 Phase 0 出口): `artifacts/triage.json` の decision で「Plan 必要 / Plan skip」 を判定。 `--with-plan` / `--no-plan` flag で override 可能
- **Gate A** (Plan → Execute、 = Plan が起動された場合のみ): `permissionMode` で判定
- **Gate B** (Execute → Verify): Stop hook で promotion
- **Retry Gate** (Verify FAIL時): retry_count と PEV_MAX_RETRIES で判定

**Gate / Triage decision の判断は `commands/pev*.md` の役割であり、 agent の責務外**。

絶対遵守ルール:

- **triage agent (v3.0+)** は `artifacts/triage.json` を書いたら **そこで完全停止**。 planner / executor を起動しない。 後続 phase 進行は commands/pev.md の Step 1.5 が決める
- planner は plan.md を書いたら**そこで完全停止**。 executor を起動しない。 Phase 2進行はGate A が決める
- executor は変更を終えたら**そこで完全停止**。 verifier を起動しない。 Phase 3進行は Gate B (Stop hook) が決める
- verifier は verify.json を書いたら**そこで完全停止**。 retry 判断は Retry Gate に委ねる
- agent は「ユーザーが続行したいはずだ」「permissionMode=default だが意図を尊重する」 のような推論で **Phase boundary を越えてはならない**

このルールが破られた場合の症状: dog food で `permissionMode=default` なのにフルパイプラインが完走してしまう (v0.5 dog food で実観測)。 Phase boundary 違反は plugin の安全設計を無効化する。

## 1. 出力の最小性

- 不要な前置きを書かない ("以下に説明します"、"これからXをします" 等)
- 結論を先に書く、根拠は後
- リスト形式を優先、長い散文を避ける

## 2. 4.7-native (4.6スタイルの禁止事項)

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

理由: Opus 4.7 は adaptive thinking で自動的にこれらを実施する。明示すると逆に冗長な scaffolding として解釈され、出力品質が下がる。

詳細は `rules/4.7-native.md` 参照。

## 3. ファイル境界

| ファイル | 書き手 | 読み手 |
|---|---|---|
| `artifacts/plan.md` | planner のみ | executor / verifier / human |
| `artifacts/execute.log` | executor | verifier / human |
| `artifacts/verify.json` | verifier | planner (retry時) / human |
| `artifacts/recap.log` | pev-recap skill | human / `/pev-status` |
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
- code内のコメントは原則書かない (rules/4.7-native.md参照)

## 7. team-conventions.md の優先順位

team-conventions.md がプロジェクトに存在する場合、その内容が本ファイルより優先される。本ファイルは「pev-harness としての規約」、team-conventions.md は「プロジェクトの規約」。
