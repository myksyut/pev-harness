# Changelog

All notable changes to pev-harness will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v1.9+
- v1.8 dog food findings (release 前 dog food で発見されたものがあれば)
- v2.0 (Issue #9): External model support via MCP

## [1.8.0] - 2026-05-12

v1.3 dog food Low 6 件 (#13-#18) と v1.7.1 dog food 3 件 (#19-#21) の合計 **9 findings 反映 release**。 Linear-workflow / agents 3 体 / pipeline flag / team-conventions template を横断的に強化し、 dog food 駆動の spec evolution を 1 release で消化。

### Added

**`--expect-fail` flag (#17)** — dog food / regression fixture 用:
- `commands/pev.md` に `--expect-fail` CLI flag 追加: retry loop を skip して即 escalate path に流す
- `skills/pev-pipeline/SKILL.md` に意味 / 挙動 / use case を spec 化
- `artifacts/recap.log` に override 記録

**parent project context injection (#16)** — `agents/planner.md`:
- Linear-sourced input section に directive 追加: `artifacts/linear/issues/<id>/sync_state.json.project_id` が非 null の場合に parent project の Why/What を Upper-AC として明示利用
- v1.3 で pev-linear-sync Inbound に取り込みステップを追加した後、 planner 側 directive が未整備だった分を補完

### Changed

**linear-project-workflow 強化 (4 件)** — `skills/linear-project-workflow/SKILL.md` + `schemas/linear-sync-state.json`:
- **#13 (L1)**: `.linear-config.yml` に `status_mapping.use_type: true` option を追加し、 Linear state object の `type` field (`backlog`/`planned`/`started`/`completed`/`canceled`) 優先 lookup を可能化 → ロケール (英 "In Progress" / 日 "進行中") に依存しない判定
- **#14 (L2)**: Update (C) で `started` 遷移時の `startedAt` / `startDate` を `side_effects[]` に必ず記録する規約を明文化、 `schemas/linear-sync-state.json` も schema 側で明示
- **#15 (L3)**: Write (B) で「AI が補完・推定した箇所」を `| 項目 | 元の自然文 | AI が推定した内容 | 確認したいこと |` table 形式で必ず提示する必須化
- **#18 (L6)**: Project description の list bullet は `-` / `*` 両許容、 parse 時に正規化する旨を明示 (false positive 警告防止)

**verifier の E2E auto-dispatch 改善 (#20)** — `agents/verifier.md`:
- 同義語 (`shows` / `displayed` / `visible`) を canonical 1 件に正規化、 `verify.json.e2e_test.dispatch_reason` の hit 数膨張を防止
- dispatch_reason を `keyword (low confidence)` / `explicit (high confidence)` の 2 段階で記録

**executor 判断 traceability (#21)** — `agents/executor.md`:
- execute.log 規約に「plan の『任意』『executor 判断』『必要に応じて』を採用した場合、 採用した選択肢と理由を明示」を追加
- plan ↔ execute 間の意思決定 audit trail を強化

**team-conventions template に Lint / Typecheck 明示 (#19)** — `skills/pev-team-conventions/SKILL.md`:
- template の必須項目に `Lint: <command> または 未設定` / `Typecheck: <command> または 未設定` を追加
- verifier が「lint コマンドを探して見つからない → スキップ」を推論する coast を削減
- `examples/sample-project/team-conventions.md` も Lint: 未設定 / Typecheck: 未設定 を反映

### Verified via dog food
- 新 fixture (event signup form) で /pev フルパイプを実機 invoke (task: plan radio + 重複申込防止 + confirmation 画面)
- 結果: **AC 7/7 PASS** (retry 1)、 vitest 33/33 + Playwright 9/9、 所要 約 15 min
- v1.8 改修動作確認:
  - `#20` `dispatch_reason: { confidence: "low", matched_canonical: ["visible", "hidden", "button", "form", "page", "navigate"], ac_indices: [...] }` で同義語膨張なし (v1.7.1 の 9 keyword verbose 出力と比較して明確に圧縮)
  - `#19` `checks.lint.detail: "Lint not configured per team-conventions.md — skip."` で team-conventions.md `Verification commands` section を読んだ短絡判定 (推論不要)
  - `#21` `execute.log` の `[judgment traceability]` section が初回 Phase 2 で 4 件、 retry 1 Phase 2 で 3 件、 plan の「任意」「採用」を全て理由付き記録
  - `#16` Linear-sourced task ではないため `project_id` null、 plan.md に `## Upper-AC` section 省略 (spec の負例として正常動作)
  - `qa_derived_checks` (v1.5+) が boundary / state / error / condition 技法で全 PASS
- 新 finding: なし (v1.8 改修すべて期待通り動作)

### Issues closed
- #13 / #14 / #15 / #16 / #17 / #18 / #19 / #20 / #21

## [1.7.1] - 2026-05-11

開発者向け internal doc を `guide/` ディレクトリに集約。 root の見通しを改善し、 plugin runtime component (`rules/`) と開発時 reference の境界を明確化。

### Changed
- 以下の dev-only doc を `guide/` 配下に移動 (`git mv` で履歴保持):
  - `docs/dogfood-v1.3-report.md` → `guide/dogfood-v1.3-report.md`
  - `docs/TEST-PLAN-linear-v1.3.md` → `guide/TEST-PLAN-linear-v1.3.md`
  - `CHECKLIST.md` → `guide/CHECKLIST.md`
  - `ROLLOUT-CHECKLIST.md` → `guide/ROLLOUT-CHECKLIST.md`
  - `FEEDBACK-TEMPLATE.md` → `guide/FEEDBACK-TEMPLATE.md`
- 空になった `docs/` ディレクトリを削除
- cross-reference を 7 file で更新: `CLAUDE.md` §11 / `ONBOARDING.md` §10 / `SPEC.md` 構造図 / `guide/CHECKLIST.md` 自己参照 / `examples/sample-project/CLAUDE.md` / `examples/sample-project/README.md` / `skills/pev-linear-sync/SKILL.md`
- `SPEC.md` 構造図に `rules/error-patterns.md` (v1.5 で追加されたが図に未反映だった) を追記

### Kept at root
- `rules/` — plugin.json `components.rules` に登録された **plugin runtime component**。 agents/skills/commands から runtime 参照されるため root 維持
- `README.md` / `ONBOARDING.md` / `CHANGELOG.md` / `LICENSE` / `SECURITY.md` / `CONTRIBUTING.md` / `SPEC.md` / `CLAUDE.md` — 公開向け or CI required file

### Design rationale
- v1.7.0 で `CLAUDE.md` を開発者向け context に再定義した流れの延長
- root が 10 file 超で見通しが悪化 → 開発時のみ参照する checklist/template/dogfood-report 系を `guide/` に集約
- `rules/` は dual purpose (dev からも runtime からも参照) だが、 plugin.json で components 登録されているため移動せず

## [1.7.0] - 2026-05-11

CLAUDE.md (repo root) を **plugin user 向け** から **pev-harness 開発者向け暗黙知集** に再定義。 v0.1 → v1.6 までの session で確立した dog food 駆動の spec evolution、 規約、 暗黙の前提を集約。

### Background

`CLAUDE.md` の auto-inject 仕様を再確認すると:

- plugin user の project では plugin の CLAUDE.md は読まれない (user の project root の CLAUDE.md のみ inject)
- pev-harness を直接開発する session (`cd ~/pev-harness && claude`) では repo root の CLAUDE.md が auto-inject される
- つまり repo root の CLAUDE.md は **「開発者 (人 + Claude session) 専用 context」** として機能する

これまで plugin user 向け文章 (install 手順 / prompt template 等) で占有していたのは誤った targeting。 plugin user 向け情報は既に [README.md](./README.md) に重複。

### Changed
- `CLAUDE.md` 完全書き換え (200 行、 11 sections):
  1. このリポジトリは何か
  2. 開発スタイル: dog food 駆動 spec evolution (v0.5-v1.6 実例 table)
  3. 絶対遵守の規約 (4.7-native / Gate respect / Single source / conventional commits)
  4. dog food fixture (sample-project 構造 / Linear test data / 手順 / reset)
  5. CI 構成 (markdownlint rule + fail パターンと対処)
  6. release procedure (10 step チェックリスト)
  7. 暗黙の前提 (公式 doc とのずれ 6 項目: Playwright `.claude/agents/` / Linear `state` name OK / save_comment 制約 / 等)
  8. tools の使い分け (TaskCreate / Background subprocess / Linear MCP / Playwright MCP / voicevox)
  9. 失敗パターンと対処 (GitHub 5xx / stale task / dog food state / forbidden phrase)
  10. やらないこと (scope creep 防止)
  11. 開発者の心構え (5 原則: user 判断 / MVP / 自律境界 / scope / CI 通すまで release)
  12. Cross-references

### Removed (CLAUDE.md から削除、 README/ONBOARDING/SPEC に既に重複)
- Plugin install 手順
- Initial-turn prompt template (Goal/Constraints/AC)
- "What this harness does NOT do" 一覧
- 4.7-native 機能活用 table

### Design rationale
- v0.1-v1.6 の dog food 駆動 spec evolution が「方法論」として確立した、 これを次の Claude session (or 人間開発者) が初手で読める形に集約
- 単なる開発手順書ではなく「**このリポジトリで以前何があったか / 何が暗黙合意か**」を含める (例: v0.5 Gate A leak → v0.6 で 3層防御 という事実、 公式 doc と実装のずれ)
- 同じ session で確立したパターン (TaskCreate の使い時、 background subprocess の使い時、 forbidden phrase fail 対処) を documenting

## [1.6.0] - 2026-05-11

v1.4 + v1.5 combined dog food (multiply 機能、 約 5min / 103k tokens) で identify した 5 件の improvement findings を spec に反映。 sample-project は dog food 後 reset 済 (add + subtract のみ)。

### Added (Findings F1-F5)

**F1: qa_derived_checks schema 拡張** (pev-test-design SKILL.md):
- `evidence_type` enum 追加: `actual_execution` / `code_inspection` / `logical_derivation` / `mirror_of`
- 各 check に `id` (D1, D2, ...) field、 plan.md の "Test design analysis" section と一意対応
- `mirror_of` field で別 check への参照可能 (圧縮目的)

**F2: Mirror compression rule** (pev-test-design SKILL.md):
- 境界値 mirror pair (例: `(0, 5)` ↔ `(5, 0)`) の圧縮ルール明文化
- 同 technique 同 semantics の mirror は 1 つを `actual_execution`、 もう片方は `mirror_of` で skip
- 非対称 (順序依存ロジック等) の場合は両方 `actual_execution` で必須

**F3: planner→executor/verifier handoff documentation** (pev-test-design SKILL.md):
- cross-phase channel 3 種を table 化:
  - `artifacts/plan.md` の "Test design analysis" section (authoritative spec)
  - `~/.claude/pev/{TASK_ID}/notes.md` (informal handoff)
  - `~/.claude/pev/{TASK_ID}/executor-{N}.md` (implementation discoveries)
- planner は plan.md + notes.md の両方に書く責務、 verifier は plan.md を必ず read

**F4: `--force-auto` フラグ** (commands/pev.md):
- permissionMode=default でも Gate A を skip して Phase 2/3 自動進行する formal channel
- Gate A 規約 (rules/pev-conventions.md §0 Gate respect) は維持: planner 自身が override 判断は禁止、 ユーザーが explicit に flag を立てる必要
- dog food / CI 自動化向け
- `artifacts/recap.log` に override timestamp + original mode を記録

**F5: Playwright test DRY pattern** (sample-project seed.spec.ts + pev-bootstrap-playwright SKILL.md):
- `test.beforeEach` で console error 監視 fixture を seed に組み込み
- `goHome(page)` 等の共通 helper 関数
- Playwright Generator agent は seed を mirror するので、 seed に DRY pattern を仕込めば generated tests も DRY になる
- pev-bootstrap-playwright SKILL.md に DRY pattern guidance section 追加

### Changed
- `examples/sample-project/` を dog food 後 reset (multiply 関連 全削除、 add + subtract のみに戻し)

### Verified via dog food
- v1.4 + v1.5 combined dog food (TES-4 "Add multiply button with range validation"):
  - planner: plan.md 187 行、 "Test design analysis" section に 6 技法 + D1-D15 派生テスト
  - executor: src/index.js / index.html / tests / 新規 multiply.spec.ts 4 files
  - verifier: PASS (unit 8/8 + e2e 8/8 + qa_derived 15/15)
  - Linear outbound: TES-4 Backlog → Done (14:18:07Z)
  - 所要 5 min、 103k tokens
- 5 件 findings を本 release で全部 spec に反映

## [1.5.0] - 2026-05-11

QA technique integration release. AC を 6 つの古典 QA 技法で分析して派生テスト観点を自動生成する `pev-test-design` skill 追加。 「AI で実装は速くなるが、テスト観点設計の質が品質を決める」 (frontline/外山, Zenn 2026-05-06) の知見を反映。

### Added
- `skills/pev-test-design/SKILL.md` — 6 QA技法 (同値分割 / 境界値分析 / デシジョンテーブル / 状態遷移 / エラー推測 / チェックリスト) を AC に適用、 不足検出 + 派生観点提案。 planner Phase 1 で AC レビュー、 verifier Phase 3 で派生 check として動く。
- `rules/error-patterns.md` — エラー推測 catalog (12 patterns: 二重送信 / 戻る再送信 / partial failure / timeout / race condition / 巨大 payload / XSS / SQL injection / 認可漏れ / empty edge case / 文字コード / time zone)
- `templates/qa-checklists/screen.md` — 画面実装 verify 観点 template (正常系 / バリデーション / ローディング / 権限 / エラー / データ整合性 / a11y / responsive / performance / console)
- `templates/qa-checklists/api.md` — API endpoint verify 観点 (contract / happy path / バリデーション / 認証認可 / rate limiting / concurrency / performance / security / error handling / observability / versioning)
- `templates/qa-checklists/db.md` — DB migration verify 観点 (migration safety / schema integrity / performance / data integrity / backward compat / security / rollback plan)
- `templates/qa-checklists/e2e.md` — E2E user flow verify 観点 (user journey / auth / form workflows / payment / multi-step wizard / realtime / mobile / cross-browser / performance / a11y)

### Changed
- `agents/planner.md` — "QA-technique self-check" section 追加: AC draft 後、 plan.md 確定前に 6 技法を self-check + plan.md に "## Test design analysis" section 追記
- `agents/verifier.md` — QA-trigger keyword 追加 (`range` / `1〜N` / `状態` / `権限` / `error` / `失敗` 等)、 `pev-test-design` 起動時の dispatch logic 追加、 verify.json に `qa_derived_checks[]` field 追加

### Design rationale
- **6 技法の選定**: frontline 外山記事 (Zenn 2026-05-06) で取り上げられた古典 QA 技法を採用、 業界共通理解として安定。
- **AC 不足の自動検出**: 「テスト書いて」ではなく「観点を整理してからテスト」が AC 段階で実現できるよう、 planner self-check に組み込み。
- **エラー推測 catalog の集中管理**: rules/ 配下に置き、 team-conventions.md で team-specific pattern を追加可能。
- **チェックリスト templates の library 化**: 4 カテゴリ (screen / api / db / e2e) で start、 team が project 固有 template を追加可能。
- **既存 verifier dispatch logic と統合**: v1.4 E2E dispatch と同じ仕組みで keyword auto-detect、 `--e2e` 等と同レベルの override は今は無し (将来 `--no-qa-design` 等を検討)。

### Reference
- 外山@frontLineLLC, ["AI駆動開発時代に、おさえておきたいQA技法"](https://zenn.dev/frontline/articles/3a912df20d9210), Zenn (2026-05-06)

## [1.4.0] - 2026-05-11

E2E verification release. Playwright CLI ベースの E2E verify を `verifier` agent に dispatch logic で統合、 Playwright が出荷する `playwright-test` agents (planner/generator/healer) を reference して test 生成・修復は委譲する設計。

### Added
- `skills/pev-e2e-verify/SKILL.md` — Playwright CLI で E2E test 実行、 AC keyword 検知 + --e2e フラグで dispatch、 artifacts/e2e/ に結果保存。 token 効率のため MCP ではなく CLI を採用 (~75% コンテキスト節約、 公式推奨)
- `skills/pev-bootstrap-playwright/SKILL.md` — 新規プロジェクトの Playwright 5-step setup (npm install / browser binary / config / seed test / init-agents)
- `commands/pev-verify-e2e.md` — explicit E2E verify invocation
- `commands/pev-init-e2e.md` — explicit bootstrap invocation
- `examples/sample-project/` を Playwright fixture 化:
  - `index.html` (minimal page、 add/subtract ボタン)
  - `playwright.config.ts` (testDir / webServer / reporter)
  - `tests-e2e/seed.spec.ts` (3 test cases、 Playwright agents の前提)
  - `vitest.config.js` (unit と E2E の scope 分離)
  - `.gitignore` (artifacts/e2e/ 等を除外)
  - `package.json` に `@playwright/test` / `http-server` を追加
  - `npx playwright init-agents --loop=claude` で `.claude/agents/playwright-test-{planner,generator,healer}.md` + `.mcp.json` + `specs/README.md` 自動生成

### Changed
- `agents/verifier.md` — E2E dispatch logic 追加:
  - AC 内の UI/E2E keyword (`click`, `navigate`, `page`, `button`, `form`, etc.) を auto-detect → pev-e2e-verify skill auto-dispatch
  - `--e2e` フラグで明示起動、 `--no-e2e` で skip
  - verify.json に `unit` / `e2e` / `dispatch_reason` を分けて記録
- `agents/verifier.md` Linear sync section と並列に E2E section 追加

### Verified via dog food (sample-project)
- ✅ `npx playwright init-agents --loop=claude` 実機動作確認 (Playwright 1.59.1)
- ✅ `.claude/agents/playwright-test-{planner,generator,healer}.md` 生成、 各 agent definition の `tools:` field に `mcp__playwright-test__*` (browser_click / browser_navigate / planner_save_plan / generator_write_test 等) が listed
- ✅ `.mcp.json` で `playwright-test` MCP server (`npx playwright run-test-mcp-server`) 設定が自動生成
- ✅ `npx playwright test`: 3/3 PASS (webServer auto-start + http-server + chromium、 1.5s)
- ✅ `npm test` (vitest): 4/4 PASS (vitest.config.js で tests-e2e/ を exclude、 cohabitation OK)

### Spec correction (公式 doc とのずれ)
- 公式 docs では Playwright agents が `.github/` 配下に生成されると記載があるが、 v1.59.1 では `.claude/agents/` に出力される。 pev-harness 関連 skill / command / verifier の記述を実装側の挙動 (`.claude/agents/`) に修正。

### Design decisions
- **CLI 採用** (MCP 不採用): ~75% コンテキスト節約。 Playwright公式 + TestDino / TestCollab benchmark を根拠。 ただし Playwright agents 自体は `playwright-test` MCP server を内部で使う (公式効率設計、 pev-harness 側で MCP 用意は不要)。
- **責務分離**: pev-harness は dispatch + test 実行 (CLI) + artifact collection。 test 生成 / 修復は Playwright agents に委譲。
- **AC keyword auto-detect + explicit flag override**: default は自動、 user が `--e2e` / `--no-e2e` で override 可。
- **sample-project fixture extension**: 既存 unit test と E2E を共存、 Vite なしの静的 HTML + http-server で minimal footprint。

## [1.3.0] - 2026-05-11

Linear integration hardening release. dog food session (28 findings) を spec に反映し、 silent corruption / fallback 欠落 / error 分類 / artifacts 命名混在を解消。 新 skill `linear-project-tracker` 追加で project ↔ issue 責務分離が完成。

### Added
- `skills/linear-project-tracker/SKILL.md` — Linear Project の child issue 進捗監視と完了判定 skill (M3)
- `schemas/linear-sync-state.json` — `artifacts/linear/{issues|projects}/<id>/sync_state.json` の JSON Schema 固定 (H3)
- `docs/dogfood-v1.3-report.md` — 28 件 findings 詳細レポート
- `linear-project-workflow` に **Preflight check** 節追加 (H1): `.linear-config.yml` 存在 + team.id 整合性 + status workflow + write permission probe
- `linear-project-workflow` に **MCP error handling** 表追加 (H2): 6 種別の error type (404/PERMISSION_DENIED/NETWORK/GRAPHQL/VALIDATION/RATE_LIMIT) × retry budget × skill 挙動
- `linear-project-workflow` Read に **parse status enum** 追加 (M1): `FULLY_PARSED / PARTIAL_PARSE / NO_INPUT / PARSE_ERROR` + `[LINEAR_INCOMPLETE_<field>]` marker 規約
- `pev-linear-sync` に **MCP warmup** 節追加 (M5): ToolSearch で linear MCP tools の load を skill 起動直後に必須化
- `pev-linear-sync` に **Fallback marker 仕様** 追加: 404 inbound 失敗時の sync_state 規約
- `pev-linear-sync` に **Warning メッセージ template** 追加: 固定文言で recap.log / agent 出力に統一
- `pev-linear-sync` に **Fallback 後の handoff 規約** 追加: skill = artifact write、 `/pev` command = agent spawn
- `pev-linear-sync` に **Responsibility separation** 表追加 (M5): skill vs `/pev` command の責務分担

### Changed
- `pev-linear-sync` Inbound に **parent project context 取り込み** 追加 (M4): `get_issue.projectId` を `get_project` に渡して Upper-AC を planner に inject (Phase 3 dog food で実証)
- `linear-project-workflow` Update (C) を改訂 (H4): `save_comment` は issue 必須なので代替パス 4 段階明示 (子 issue 経由 / status_update / description embed / skip)、 `state` 引数は name 文字列で OK、 副作用 (`startedAt` 等) を sync_state に記録
- `linear-project-workflow` artifacts 命名規約を統一 (H3): `artifacts/linear/issues/<id>/sync_state.json` と `artifacts/linear/projects/<id>/sync_state.json` の二系統に分離 (旧: UUID dir と identifier.json の混在)
- `examples/sample-project/.linear-config.yml.example` を v1.3 schema に更新 (M2): `status_mapping` を `issue` と `project` で分離、 Issue は team workflow、 Project は固定 5 種で別管理

### Verified via dog food (1 session, 約 1h16min)
- ✅ Phase 1: linear-project-workflow Read / Write preview / Write commit / Update checkbox / Update status / Validation 全 6 sub-phase
- ✅ Phase 2: pev-linear-sync Inbound / Gate A halt / Outbound success (TES-1 Done) / Outbound fail (TES-2 retry exhausted, Backlog 維持) / Fallback (404)
- ✅ Phase 3: 統合シナリオ (project ↔ issue ↔ PEV pipeline)
- ✅ Phase 4: edge cases 5 種 (config 不在 / team mismatch / status_mapping miss / parse 不能 / permission)
- ✅ Phase 5: 観察 (token / latency / friction / agent 判断ミス頻度)

### Known limitations (Low priority、 GitHub Issue 化)
- L1-L6: state type field 活用、 side effects 記録、 AI 補完 "要確認" pattern 規約化、 parent project context inject pattern 規約化、 `plan.expectFail` flag、 `*`/`-` 両許容明示 — v1.4+ で対応

### Closes
- v1.2 で残った Linear integration の spec gap を `docs/dogfood-v1.3-report.md` 経由で comprehensive に解消

## [1.2.0] - 2026-05-11

Linear sync release: `/pev <linear-issue-url>` で Linear Issue から spec を抽出し、 完了時にコメント + status 更新を投げる双方向 sync skill。

### Added
- `skills/pev-linear-sync/SKILL.md` — Linear MCP server経由の双方向 sync skill (closes #8)
  - Inbound: Linear Issue URL → spec 抽出 (title/description/labels/priority/assignee を PEV spec にマッピング)
  - Outbound success: PASS verdict → Linear に `## ✅ PEV completed` コメント + Issue status を Done 相当に遷移
  - Outbound fail: retry 上限到達 → Linear に `## ⚠️ PEV escalated` コメント + status は変更しない (Done にしない)
- `examples/linear-task-flow.md` — Happy path / Escalation / MCP unavailable / Troubleshooting の4シナリオ

### Changed
- `commands/pev.md` — Linear URL 引数検出を Usage と Flow Step 1 に追加。 `linear\.app/[^/]+/issue/([A-Z]+-\d+)` 正規表現で identifier 抽出。 Linear MCP unavailable 時は通常 PEV flow にfallback
- `agents/planner.md` — Linear-sourced input セクション追加。 plan.md 冒頭に Linear binding 表記。 Linear Issue の Constraints と team-conventions.md が衝突した場合は team-conventions を優先 + Risks セクションに記録
- `agents/verifier.md` — Linear sync セクション追加。 PASS / 最終 FAIL の2状態で outbound sync を起動 (retry 中の中間 FAIL では Linear に投稿しない、 noise 防止)
- `SPEC.md` 内の v1.x ロードマップ参照 (skipped — メンテ後回し)

### Known limitations
- **dog food 未実施 (実 Linear workspace なし)**: 仕様だけ整備、 動作確認は v1.2 利用者の最初のフィードバックで詰める。
- **status name は team によって異なる**: "Done" / "Completed" / "Released" のいずれにもマッチしない場合は status 変更 skip、 コメントだけ投稿
- **複数 Linear workspace の同時操作は未対応**: 1 task = 1 issue 前提
- **Bidirectional 同期だが Linear 側の polling は未実装**: Linear 側で Issue が edit された場合、 ローカル artifacts/ には反映されない (next refresh は再 inbound)

### Note on numbering
- Original roadmap had Linear as v1.1, but v1.1.0 was consumed by the OSS readiness work (LICENSE / SECURITY / templates). Linear sync becomes v1.2.0.

## [1.1.0] - 2026-05-11

OSS readiness release. MVP-level defenses to make the repository safe and welcoming for public distribution. Goal: stars-friendly + minimal viable protection, then iterate.

### Added
- `LICENSE` — MIT (was already declared in `.claude-plugin/plugin.json`, now ships as a file)
- `SECURITY.md` — vulnerability disclosure policy with SLA, threat model, scope/out-of-scope, GitHub Security Advisory channel
- `.github/CODEOWNERS` — default and security-sensitive path ownership for auto-assigned reviews
- `.github/dependabot.yml` — weekly GitHub Actions dependency updates (CI侵入防止の基礎)
- `.github/PULL_REQUEST_TEMPLATE.md` — PEV-aware PR template with dog food evidence checklist and 4.6 scaffolding check
- `.github/ISSUE_TEMPLATE/bug_report.yml` — structured bug report template (version / phase / artifacts snapshot)
- `.github/ISSUE_TEMPLATE/feature_request.yml` — feature request with explicit "considered alternatives" prompt
- `.github/ISSUE_TEMPLATE/config.yml` — routes security to Advisory, questions to Discussions, blocks blank issues

### Changed
- `.github/workflows/ci.yml` — added `permissions: contents: read` at workflow and job level, plus `timeout-minutes: 5` to limit hijack blast radius
- `README.md` — rewritten for OSS audience with "Why this exists" / "What it does" / "Quick start" structure, license + claude-code badges, threat model callout, public Issues/Discussions links
- `ONBOARDING.md` §9-§10 — generalized "Slack 社内" references to GitHub Discussions / Issues; ROLLOUT-CHECKLIST and FEEDBACK-TEMPLATE marked as organization-internal
- `ROLLOUT-CHECKLIST.md` + `FEEDBACK-TEMPLATE.md` — header note added: "for organization-internal deployment, individual OSS users don't need this"
- `CHECKLIST.md` §13 — transfer suggestion generalized (was emuni-kyoto-specific)

### Verified
- git history audit: no secrets / no organization-internal email leakage (single contributor with personal gmail)
- Working tree audit: no `password=`, `secret=`, `api_key=`, or private key patterns

### Pre-public-release checklist for the human

Visibility flip from private to public is not automated. The human owner should:

1. Final manual diff review of `git log --all` and working tree once more
2. `gh repo edit myksyut/pev-harness --visibility public --accept-visibility-change-consequences`
3. Enable Discussions: `gh api repos/myksyut/pev-harness --method PATCH -f has_discussions=true`
4. Set up branch protection on `main` (GUI or `gh api`): require PR + CI green + 1 approving review
5. Verify Dependabot has access to update PRs (Settings → Security → Dependabot)

## [1.0.0] - 2026-05-11

Production-ready release. Internal team rollout preparation complete. v0.1 → v0.6 functional development closes here; v1.0 packages it for use by other teams.

### Added
- `ROLLOUT-CHECKLIST.md` — per-team installation tracking template (pre-rollout / project preparation / first task / post-rollout feedback)
- `FEEDBACK-TEMPLATE.md` — structured 5-task feedback collection form including quantitative observations (first-pass rate, retry count, sentiment 1-5)
- README badges (CI status, version, status, Claude Code min version)
- README v1.0 production-ready callout pointing at ONBOARDING + ROLLOUT-CHECKLIST

### Changed
- `ONBOARDING.md` — expanded to 10 sections including:
  - 個人インストール (永続 / 一時利用 の2モード)
  - プロジェクトへの導入 with concrete bash steps
  - 6-row FAQ / troubleshooting table covering v0.5→v0.6 Gate A leak symptoms
  - v1.0 known limitations enumerated explicitly
  - フィードバック方法 + ロールアウト管理者向け cross-reference
- `SPEC.md` §11 ロードマップ — Status column added, v0.1-v0.6 marked released, v1.0 marked "released, rollout pending"

### Rollout open question (Issue #7 stays open)
- Actual 3-team rollout is human-driven work and will be tracked in Issue #7 with comments rather than closed here
- 5-task feedback minimum per team
- v1.1 priorities will be set from collected feedback

## [0.6.0] - 2026-05-11

Gate A enforcement release: closes the boundary leak that v0.5 dog food uncovered, where planner was bypassing `permissionMode=default` on its own initiative.

### Added
- `rules/pev-conventions.md` §0 "Gate respect" — promotion across Phase boundaries is the role of `commands/pev*.md`, never of agents. Spelled out for all three gates (A, B, Retry) with the explicit anti-pattern from v0.5 dog food cited as motivation (closes #10)

### Changed
- `agents/planner.md` — 禁止事項 expanded: "Gate A の判断を自分で行うこと" and "ユーザーはきっと続行したいはず推論で Phase 2 を起動すること" are now explicit forbidden behaviors
- `commands/pev.md` Step 3 (Gate A) — halt language strengthened to "STOP. Plan phase complete. DO NOT auto-proceed to Phase 2." Default branch also covers the `default|*` case explicitly so unset `permissionMode` falls into the safe halt path
- `commands/pev.md` adds an explicit "executor 起動条件" subsection making clear that only `permissionMode == "auto"` permits Phase 2 promotion

### Verified via dog food
- Clean run with `permissionMode=default`: planner produces plan.md, recap.log shows "Phase 1 (Plan) complete; Gate A halted", **src/index.js remains untouched**, no execute.log, no verify.json
- planner's response surfaces both continuation options (`/pev-execute` or switch to `auto`) without making the choice for the user
- v0.5 leak pattern ("ユーザー意図を尊重して続行") no longer appears

## [0.5.0] - 2026-05-11

Team-rollout readiness release: team-conventions auto-injection becomes an explicit protocol that planner/executor follow uniformly, instead of relying on agent-side improvisation.

### Added
- `pev-team-conventions` injection protocol — read order, target sections, fallback behavior, all spelled out as a regulation rather than a hope (closes #6)
- Personal override path `~/.claude/pev/team-conventions.local.md` for individual additions that don't belong in team-wide rules
- Per-section utilization mapping (Language & Stack → planner Constraints; Code style → executor; Review rubric → verifier --strict; etc.)

### Changed
- `skills/pev-team-conventions/SKILL.md` — rewritten as protocol spec with read order, injection position (`# Your task` 直前), per-section targets, and absent-file behavior
- `agents/planner.md` — gains explicit "Team conventions loading" section: planner now reads conventions in fixed order and integrates per-section into plan.md, plus must declare in plan.md which conventions were applied
- `agents/executor.md` — gains the same loading section, with utilization mapped to its specific operations (Code style → Edit/Write; Forbidden → don't emit; Files to never touch → bounce back to planner; Commit policy → execute.log format)

### Notes
- Behavior observed organically in v0.1/v0.2 dog food runs (planner pulled team-conventions.md into Constraints unbidden). v0.5 codifies what was working, so all three phase agents do it uniformly
- Same-skill/same-pattern hardcoding is avoided — projects supply their own conventions, the skill just enforces how they're loaded

## [0.4.0] - 2026-05-11

Dual review release: pev-dual-review skill rewritten with executable Agent tool spawn protocol, structured JSON merge logic, and an agreement_pct metric for measuring model diversity health.

### Added
- `examples/verify.strict.example.json` — concrete example of `--strict` mode output showing reviewer_a / reviewer_b / merged sections (closes #5)
- agreement_pct metric in merged section — measures how often Reviewer A and B catch the same issue; 100% suggests rubric is too loose, low values indicate healthy model diversity

### Changed
- `skills/pev-dual-review/SKILL.md` — rewritten from pseudocode to executable spec:
  - Concrete Agent tool spawn pattern (same-message parallel dispatch)
  - Complete Reviewer prompt template
  - JSON merge logic with dedupe-by-substring
  - Reviewer A/B differentiation rationale (Opus xhigh for arch + Sonnet high for impl correctness)
- `commands/pev-verify.md` — `--strict` 動作詳細 section added with concrete 6-step flow
- `agents/verifier.md` — `--strict` mode responsibilities expanded (verifier is now the parent agent that spawns A/B and merges)

### Known limitations carried forward
- Model diversity is partial: both reviewers are Claude family. True external-model diversity deferred to v2.0 (#9)
- v0.4 logic not yet exercised in dog food; first real strict-mode run will validate the same-message parallel spawn pattern

## [0.3.0] - 2026-05-11

Quality release: verifier now writes durable memory, task_budget skill rewritten for Claude Code v2.1.x reality. Verified end-to-end via second dog food run.

### Added
- `agents/verifier.md` — explicit "Memory write" directive: write per-check evidence and AC verification reasoning to `~/.claude/pev/{TASK_ID}/verifier.md`. Retry rounds append rather than overwrite, preserving the full verification history (closes #4)

### Changed
- `skills/pev-task-budget/SKILL.md` — completely rewritten to reflect Claude Code v2.1.x reality:
  - Layer 1: agent prompt embedded "Estimated task budget" (dog food confirmed working)
  - Layer 2: `ANTHROPIC_BETA=task-budgets-2026-03-13` env var for users who want API beta header
  - Honest limitation notes about v0.x partial passthrough
  - v2.0+ roadmap link via #9 for true MCP-server-based external model support
  - (closes #3)

### Verified via dog food (v0.2 features now confirmed)
- ✅ Gate A (permissionMode=default) halts after Phase 1 as designed
- ✅ planner Memory write produces structured `~/.claude/pev/{TASK_ID}/notes.md` with Key decisions / Notes for executor / Notes for verifier / Open questions sections
- ✅ Stop hook auto-appends Phase completion entries to `recap.log`
- ✅ team-conventions.md content automatically included in plan.md Constraints section

### Known limitations carried forward
- Stop hook still cannot invoke `/pev-verify` slash command — user-triggered (limitation of Claude Code hook system)
- Phase 2/3 dog food validation pending — requires `permissionMode=auto` or manual `/pev-execute` continuation

## [0.2.0] - 2026-05-11

Functional release: Gate A actually decides on permissionMode, task lifecycle has real cleanup paths, and recap.log is no longer dependent on agent goodwill.

### Added
- `commands/pev.md` — concrete Bash for task_id init, permissionMode-aware Gate A branching, retry counter (closes #1)
- `commands/pev-status.md` — `--gc` / `--gc --apply` modes for 30-day stale memory directory cleanup, plus `--recent` and `--escalate` (closes #2)
- `agents/planner.md` — explicit "Memory write" directive: write key decisions and open questions to `~/.claude/pev/{TASK_ID}/notes.md`
- `agents/executor.md` — explicit "Memory write" directive: read peer executors' memory at startup to avoid file collisions; write own progress on completion
- SessionStart hook — surfaces stale tasks (>30 days) with `/pev-status --gc` hint

### Changed
- `hooks/hooks.json` Stop hook — now auto-appends Phase 2/3 completion entries to `artifacts/recap.log`, addressing the dog food gap where recap was relying on agent-side initiative
- Stop hook also surfaces verdict (PASS/FAIL from verify.json) when verifier has run

### Fixes
- Dog food gap: Phase completion now leaves a durable record in recap.log without requiring agent compliance
- Dog food gap: subagent memory directory `~/.claude/pev/{task_id}/` now has explicit write directives in agent prompts

### Known limitations carried forward
- Stop hook still cannot directly invoke `/pev-verify` (Claude Code hooks don't yet support command-triggered slash invocations); user must run `/pev-verify` manually after seeing the Stop hook message
- `task_budget` API beta header passthrough still indirect (Issue #3)

## [0.1.1] - 2026-05-11

Patch release: CI fix, agent frontmatter improvements, skill-finder addition, dog food validation.

### Added
- `skills/skill-finder/SKILL.md` — meta-skill for evaluating external skills before adoption (adapted from mizchi/skills)
- `examples/dog-food-evidence/` — concrete artifacts from automated dog food run (plan.md + execute.log)
- `effort` field on all 3 agents (planner: xhigh, executor: high, verifier: xhigh) — confirmed officially supported in Claude Code v2.1.x

### Changed
- `commands/pev*.md` — simplified, removed embedded Bash blocks (deferred to v0.2 with Issue links)
- `.markdownlint.json` — disabled noisy rules (MD040/MD031/MD032/MD022/MD034) for documentation-heavy repo
- `examples/sample-project/src/index.js` — restored TODO state after dog food (kept as recurring test fixture)
- `.gitignore` — added `node_modules/` and `package-lock.json` for examples/sample-project

### Fixed
- CI workflow now passes (markdownlint rules tuned)

### Confirmed via dog food
- ✅ Phase 1 (Plan) generates high-quality plan.md with team-conventions.md awareness
- ✅ Phase 2 (Execute) successfully implements minimal changes
- ✅ Acceptance Criteria checked via real test execution (vitest 2/2 PASS)
- ⚠️ Stop hook auto-trigger of verify did not fire in headless mode → Issue #4
- ⚠️ recap.log auto-write missing → Issue #4
- ⚠️ subagent memory directory empty → Issue #2

## [0.1.0] - 2026-05-11

Initial scaffold release. Plan-Execute-Verify coding harness for Claude Opus 4.7.

### Added

#### Core Components
- 3 agents: `planner`, `executor`, `verifier`
- 8 skills: `pev-pipeline`, `pev-spec-template`, `pev-task-budget`, `pev-focus-mode`, `pev-recap`, `pev-subagent-memory`, `pev-dual-review`, `pev-team-conventions`
- 5 commands: `/pev`, `/pev-plan`, `/pev-execute`, `/pev-verify`, `/pev-status`
- 3 hooks: `PreToolUse` (safety guard), `Stop` (verify prompt), `SessionStart` (task resume detection)
- 2 rules: `pev-conventions`, `4.7-native`

#### Documentation
- `SPEC.md` (12 sections + 5 ADRs)
- `README.md` (public-facing)
- `CLAUDE.md` (plugin manifest for Claude Code)
- `ONBOARDING.md` (team rollout guide)

#### Examples
- `examples/plan.example.md`
- `examples/execute.example.log`
- `examples/verify.example.json`
- `examples/verify.fail.example.json`
- `examples/recap.example.log`
- `examples/team-conventions.example.md`
- `examples/sample-project/` (minimal dog food project)

#### Infrastructure
- `.gitignore` for `artifacts/` and local settings
- `settings.json` with team defaults (model: opus, effort: xhigh, permissionMode: default)
- `.claude-plugin/plugin.json` manifest
- GitHub Actions CI for markdownlint + JSON schema validation

### Design Decisions

See `SPEC.md` Section 12 for full ADR log:

- ADR-001: Why fixed 3-phase pipeline (Plan / Execute / Verify)
- ADR-002: Why dropped external CLI dependency for dual-review
- ADR-003: Why `artifacts/` is gitignored
- ADR-004: Why parallel executor max is 3
- ADR-005: Why Stop hook handles verify auto-invocation

### Known Limitations

- Dual review uses same model family (Claude only) — true model diversity deferred to v2.0
- Language-specific tooling not bundled — relies on project-side formatter/linter
- Windows untested — macOS / Linux only verified
- `task_budget` API beta header passthrough is partial in Claude Code v2.1.x

[Unreleased]: https://github.com/myksyut/pev-harness/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/myksyut/pev-harness/releases/tag/v0.1.0
