# Changelog

All notable changes to pev-harness will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for v3.1+
- Triage 判定基準の dog food tuning (v3.0-alpha で集めた精度データを反映)
- Plan-less mode の executor self-clarify (= 実装中に不明確点が出たら user へ質問)
- bin/pev-interactive helper script (= no-harness 側でも質問返し path を mitigate)
- Gemini CLI 対応 (元 v2.2+ スコープ、 v3.x で再評価)

## [3.0.2] - 2026-05-13

**ドキュメント align**。 v3.0 / v3.0.1 で構造変更 (Triage 新設、 Plan on-demand、 質問判定強化、 F1 scope 限定) を agents / commands / CHANGELOG に反映していたが、 CLAUDE.md / SPEC.md / README / ONBOARDING / rules / skills / examples / guide の各 doc が v2.x 当時のまま stale だった。 v3.0.2 で全 active doc を v3.0 reflect、 歴史 doc (v1.x dog food log 等) には disclaimer note を追加。

### Documented

- **CLAUDE.md**: §0 current version note + §1 history table に v2/v3 entries + §2.2 Gate respect の v3.0+ 注記 + §3.1 sample-project の form fixture 反映 + §3.3 dog food 手順を stream-json input mode に + §11 cross-references に experiments/ 追加
- **SPEC.md**: 冒頭文を v3.0 reflect、 §4 Plan-Execute-Verify 詳細に Phase 0 (Triage) 追加、 §8 Commands に `--with-plan` / `--no-plan` flag、 §9 artifacts に triage.json、 ADR-001 を「3-phase 固定 → on-demand に変更」 に rewrite
- **README.md**: tagline を `(Triage →) Plan → Execute → Verify pipeline (v3.0+)` に
- **ONBOARDING.md**: §3 期待動作を Phase 0 (Triage) 追加 + flag override 説明
- **rules/pev-conventions.md**: §0 Gate respect に Triage decision を追加、 triage agent の停止 rule
- **skills/pev-pipeline/SKILL.md**: Phase 遷移ルールに Phase 0 + Flag override + artifacts table に triage.json
- **skills/pev-recap/SKILL.md**: When to Use に triage agent 追記
- **skills/pev-spec-template/SKILL.md**: When to Use に Triage 経由 note
- **agents/verifier.md**: v3.0+ Mode B (plan-less) 対応の verification path
- **commands/pev-execute.md**: Mode A / Mode B の 2 mode 説明 + `--plan-less` flag
- **commands/pev-plan.md**: v3.0 で「Triage を skip して直接 Plan のみ」 と明示
- **commands/pev-verify.md**: 前提条件に「plan.md または triage.json のいずれか」、 plan.md なしの verification path
- **examples/README.md / team-conventions.example.md**: v3.0+ note
- **guide/CHECKLIST.md / FEEDBACK-TEMPLATE.md / ROLLOUT-CHECKLIST.md**: v3.0+ note + 新規 axis (Triage 精度 / Plan 確認質問の有用性 / F1 挙動)

### Not changed

- 歴史 doc (`guide/dogfood-v1.3-report.md` / `guide/TEST-PLAN-linear-v1.3.md` / `examples/dog-food-evidence/`): v1.x 当時の reality 記録として時系列維持
- `examples/linear-task-flow.md`: v1.2+ Linear 例なので v1.x context のまま

### Reference

- v3.0 設計: [experiments/v3.0-design.md](experiments/v3.0-design.md)
- v3.0 dog food 根拠: [experiments/harness-effect-v1 to v5](experiments/)

## [3.0.1] - 2026-05-13

**harness-effect-v5 dog food findings reflection** (F_v5_1)。 v3.0 を 別 task (申込キャンセル機能) で再走、 効果の再現性 (軸 1-4 で +6) を確認したうえで、 検出した **「pattern 踏襲指示が Plan の質問を抑制する」 問題** (= F_v5_1) に対する patch。

### Verified via dog food

- `experiments/harness-effect-v5/`: 申込キャンセル機能 task で v3.0 with-harness が no-harness を軸 1-4 で **+6** で勝利 (= v3-dogfood の +8 に続く 2 例目の再現)
- 内心 spec との一致率: **12/15 (= 80%)**、 ただし `window.confirm()` dialog (Q4) を Plan が質問せず推測 minimal で skip した結果 AC2 落ち

### Changed

- **`agents/planner.md`** に「**「pattern 踏襲」 指示が来ても質問する (v3.0.1+)**」 section 追加。 `既存 pattern を踏襲` 等の prompt 指示があっても、 pattern では一意に決まらない要素 (dialog / 削除方式 / 状態遷移細部 / 拡張 feature 有無 / error UX) は **質問必須**

### Added

- `experiments/harness-effect-v5/` 新設 — 申込キャンセル機能で v3.0 の再現性検証 + F_v5_1 検出

### Reference

- [experiments/harness-effect-v5/reports/SUMMARY.md](experiments/harness-effect-v5/reports/SUMMARY.md)

## [3.0.0] - 2026-05-12

**ハーネスの value proposition を「user の頭の中の spec を引き出す」 に再定義**。 harness-effect-v1/v2/v3/v4 の 4 つの実験 ([experiments/](experiments/)) から、 v2.x の PEV pipeline は (a) 質問返し channel の脆さ / (b) F1 Defensive default の minimal 倒れ / (c) 効率コスト 12-18x / (d) Plan の overkill 等の構造的問題を抱えていることが明らかになった。 v3.0 は **Triage agent 新設 + Plan の on-demand 化 + 質問判定強化 + F1 scope 限定** で根本見直し。

### Breaking changes

- **default flow が変わる**: `/pev <task>` で Triage agent (Phase 0) が「Plan 必要性」 を判定、 多くの実務 task では Plan を skip して直接 Execute → Verify
- **plan.md が出ない場合がある**: artifacts/plan.md を expect する CI / hooks は要 update (v3.0 では plan.md がなくても verify.json は出る)
- **F1 (Defensive default) の scope 限定**: v2.1.6 で全領域に適用していた「不明確 → defensive 拒否」 を、 v3.0 では **security / data integrity / 状態不整合 のみ** に限定。 UI 拡張 / 表示 detail / nice-to-have は **質問必須** に変更
- **旧挙動互換**: `/pev <task> --with-plan` で v2.x 互換 (Triage skip + Plan を必ず起動)

### Added

- **`agents/triage.md`** 新設 — Plan 必要性を 1 turn 以内で判定する軽量 router agent (model: sonnet, effort: low)。 cwd context (既存 codebase / spec doc / team-conventions.md 有無) + prompt の曖昧度を LLM 判断で評価、 `artifacts/triage.json` に decision + reasoning + signals を出力
- **`commands/pev.md`** に **Step 1.5 (Phase 0: Triage)** を追加。 `--with-plan` / `--no-plan` flag を導入
- **`agents/planner.md` 「## 確認質問」 protocol** — Goal / Constraints / AC が欠ける、 もしくは grey zone な拡張要素が未明示の場合、 plan.md 冒頭に確認質問を列挙して user に問う (v3.0 で必須機能)

### Changed

- **`agents/planner.md` Defensive default の scope 限定** (F1 refine):
  - 適用領域: security / data integrity / 状態不整合 (= 引き続き defensive 拒否を AC に書く)
  - 適用外領域: UI 拡張 feature / 表示 detail / nice-to-have / 不明確 spec 補完 / アーキテクチャ判断 → **質問必須に変更** (= harness-effect-v4 で発生した counter UI 漏れを防ぐ)
- **`agents/executor.md` Mode B (plan-less) 対応** — Triage が plan_skip と判断した場合、 plan.md なしで task description + cwd context を直接読んで実装。 不明確な点に直面したら推測せず停止 (= 自己 clarify は v3.1+ で検討)
- **`commands/pev.md` フロー** を Triage → (Plan?) → Execute → Verify に再構成

### Verified via experiments (harness-effect-v1 to v4)

| 実験 | task 性質 | v2.x 結果 | v3.0 期待 |
|---|---|---:|---|
| v1 (明確 spec) | WebSocket chat | タイ | ✓ Plan skip で overhead 削減 |
| v2 (中曖昧 + text input) | TODO アプリ | no-harness 勝ち | △ Plan の質問判定強化で対応、 stream-json input 推奨 |
| v3 (中曖昧 + stream-json) | TODO アプリ | **with-harness 勝ち** | ✓ 再現性確保 |
| v4 (中曖昧 + 既存 codebase) | 申込フォーム機能追加 | no-harness 勝ち (counter UI 漏れ) | ✓ F1 scope 限定 + 質問必須 で解決 |

詳細: [experiments/v3.0-design.md](experiments/v3.0-design.md) + [experiments/RFC-v3.0.md](experiments/RFC-v3.0.md)

### Migration (v2.x → v3.0)

旧 default (= 常時 PEV): `/pev <task> --with-plan` で互換
新 default (= on-demand Plan): `/pev <task>` のまま、 ただし Triage 判定で Plan skip される task が多くなる

### Reference

- [experiments/harness-effect-v1 to v4](experiments/) の SUMMARY.md 群
- [experiments/v3.0-design.md](experiments/v3.0-design.md)

## [2.1.6] - 2026-05-12

**harness-effect-v1 dog food findings reflection**。 ハーネスありなしで同一 prompt から WebSocket chat を実装させる comparative experiment ([experiments/harness-effect-v1/](experiments/harness-effect-v1/)) で抽出した 4 件の findings を agents / experiment 周辺に反映。 ハーネスあり側が plan で「空 body は許容」と判断してしまい、 結果的にハーネスなし側より仕様逸脱しやすいという本末転倒な事象 (F1) を防ぐ defensive default 原則を planner に追加。

### Added

- **`experiments/harness-effect-v1/`** 新設 — 効果検証実験フレームワーク。 SPEC.md / prompt.txt (両者共通)、 EVALUATION.md (4 軸 × 10 点)、 run.sh (2 並行 background)、 extract-metrics.sh + extract-metrics-v2.py (phase 別 breakdown)、 reports/ (metrics.json / SUMMARY.md)。 `claude --plugin-dir ~/pev-harness` での `/pev-harness:pev <prompt> --force-auto` wrap と plain claude を同一 prompt で比較
- **`agents/planner.md` "Defensive default for unspecified input (v2.1.6+)"** — 同値分割の運用原則として、 仕様で明示的に許容されていない input は defensive (拒否 / no-op) を default にする。 plan.md の Test design analysis に該当 default を列挙する義務化
- **`agents/executor.md` "DRY / duplication self-review (v2.1.6+)"** — verifier に渡す前に、 同関数の再実装 / loop pattern 重複 / dead import / dead branch / dead comment を self-check する。 検出は実装中に修正、 未解消は execute.log に明示

### Changed

- **`experiments/harness-effect-v1/prompt.txt`** — 動作確認シナリオ S1-S5 を明記、 空メッセージ拒否 (E2) / 切断時 reconnect (E1) を「必須」 側に移動。 SPEC.md との 1:1 整合性確保

### Verified via dog food (harness-effect-v1 baseline run)

- **F1 (Plan の defensive bias)**: with-harness が `空 body は許容` と plan で判断、 第三者シナリオ S2 で FAIL。 no-harness は同 prompt から自発的に defensive 実装
- **F2 (executor の DRY 抜け)**: with-harness の `server.js` で `broadcast()` 定義後に `wss.clients.forEach()` を直接実装、 plan 外の重複
- **F4 (prompt 設計の公平性)**: prompt.txt が SPEC.md より緩く、 評価軸 S2 が両者で非対称になった
- **F5 (効率軸の解像度)**: 合計値だけでなく Plan / Execute / Verify phase 別の turn / token を分解できるよう extract-metrics-v2.py で実装

### Reference

- experiment report: [experiments/harness-effect-v1/reports/SUMMARY.md](experiments/harness-effect-v1/reports/SUMMARY.md)
- baseline metrics: [experiments/harness-effect-v1/reports/metrics-v2.json](experiments/harness-effect-v1/reports/metrics-v2.json)

## [2.1.5] - 2026-05-12

**Project scope install (team 共有) 手順を docs に追加**。 これまで `README.md` `ONBOARDING.md` の install 手順は **user scope のみ** で、 「team 全員が同じ project で同じ pev-harness version を使うことを保証する」 経路が明示されていなかった。 公式 [Configure team marketplaces](https://code.claude.com/docs/en/discover-plugins.md#configure-team-marketplaces) の仕様 (`.claude/settings.json` の `extraKnownMarketplaces` + `enabledPlugins`) に沿って 2 つの Pattern を併記。 docs-only patch。

### Documented

- **`ONBOARDING.md` §1.2「Project scope install」 新規**: Pattern P1 (`.claude/settings.json` 直編集 + git commit で team 共有) + Pattern P2 (`claude plugin install --scope project` で同等 JSON を CLI 生成) を併記、 scope 3 種 (user / project / local) の比較表 + 使い分けの目安 + CI / 非対話環境では user scope 経由が安全という注記
- **`README.md` Quick start** を 3 セクション化 (A: 個人 user scope / B: team 共有 project scope / C: セッション単位 `--plugin-dir`)。 B から ONBOARDING §1.2 へ deep link

### Changed

- **`.claude-plugin/plugin.json`** / **`.claude-plugin/marketplace.json`** version を `2.1.4` → `2.1.5` に同期
- **`README.md`** version badge を `2.1.4` → `2.1.5`
- **`SPEC.md` §11 ロードマップ** に v2.1.5 row 追加

### Reference

- 公式 docs: <https://code.claude.com/docs/en/discover-plugins.md#configure-team-marketplaces>
- scope 仕様: <https://code.claude.com/docs/en/settings.md#configuration-scopes>

## [2.1.4] - 2026-05-12

**連携 plugin (Linear MCP / Playwright / Codex CLI) の prerequisites 明示**。 これまで pev-harness `skills/pev-linear-sync/` `skills/linear-project-workflow/` `skills/linear-project-tracker/` の 3 skill と `agents/verifier.md` の Linear push path は **Linear MCP が install されている前提** で書かれていたが、 `README.md` `ONBOARDING.md` `guide/ROLLOUT-CHECKLIST.md` のいずれにも setup 手順がなく、 別ユーザーが Linear sync 機能に到達できないギャップがあった。 ドキュメント追記のみの patch (機能変更なし)。

### Documented

- **`README.md`** に「Optional integrations」 セクション新規追加。 Linear / Playwright / Codex CLI それぞれの install コマンドと「使う機能だけ install」 方針を明記
- **`ONBOARDING.md` §1.5「連携 plugin」** 新規追加。 Linear MCP は `claude plugin marketplace add anthropics/claude-plugins-official` + `claude plugin install linear@claude-plugins-official` + 初回 OAuth で setup 完了、 Linear hosted HTTP MCP (`https://mcp.linear.app/mcp`) をラップする仕組みを補足
- **`guide/ROLLOUT-CHECKLIST.md`** Pre-rollout 個人項目に「Linear sync を使うチーム: linear plugin install + OAuth 完了」 と「dual-codex を使うチーム: Codex CLI + auth login 完了」 の 2 チェックを追加

### Changed

- **`.claude-plugin/plugin.json`** / **`.claude-plugin/marketplace.json`** version を `2.1.3` → `2.1.4` に同期
- **`README.md`** version badge を `2.1.2` → `2.1.4` (v2.1.3 で更新漏れだったため整合)

### Reference

- 公式 Anthropic Linear plugin: <https://github.com/anthropics/claude-plugins-public/tree/main/external_plugins/linear>
- Linear hosted MCP: `https://mcp.linear.app/mcp`

## [2.1.3] - 2026-05-12

**Anthropic 公式 [anthropics/skills](https://github.com/anthropics/skills) から汎用開発系 skill 2 件を完全 vendoring**。 plugin install するだけでチーム全員が `skill-creator` (skill 自体の作成・eval・description 最適化) と `frontend-design` (production-grade UI 設計、 AI slop 回避) を利用可能になる。 機能変更なし、 純粋な追加リリース。

### Added

- **`skills/skill-creator/`** ([anthropic-source](https://github.com/anthropics/skills/tree/main/skills/skill-creator)) — skill の draft → eval → iterate ループを支援する meta-skill。 `agents/` (grader / comparator / analyzer) + `scripts/` (run_eval.py / improve_description.py / quick_validate.py / aggregate_benchmark.py 等) + `eval-viewer/` (HTML レポート生成) + `references/schemas.md` を同梱。 pev-harness 自身の skill 開発 (今後の v2.2+ 機能追加) を加速する用途
- **`skills/frontend-design/`** ([anthropic-source](https://github.com/anthropics/skills/tree/main/skills/frontend-design)) — distinctive な UI 設計ガイド。 typography / layout / color / motion の出分け、 「AI slop (generic aesthetic)」 を避けるための bold な aesthetic direction 選定指針。 PEV pipeline で UI 系タスクを扱う際の補助として `examples/sample-project` の HTML 編集にも使える
- 両 skill とも upstream の `LICENSE.txt` を同梱 (MIT)

### Changed (vendoring 対応の CI rule 緩和)

- **`.github/workflows/ci.yml`** — forbidden phrase check に `--exclude-dir=skill-creator --exclude-dir=frontend-design` を追加。 markdownlint にも `--ignore 'skills/skill-creator/**' --ignore 'skills/frontend-design/**'` を追加。 公式 skill は upstream wording (`"take your time"` `"Be thorough"` `"step-by-step"` 等を含む) を改変せず vendoring する原則のため
- **`rules/4.7-native.md`** に「vendored Anthropic 公式 skills の扱い」 セクション追加。 PEV-harness 独自 skill には引き続き禁止 rule を適用、 vendored 部分のみ例外という運用方針を明記
- **`.claude-plugin/plugin.json`** / **`.claude-plugin/marketplace.json`** version を `2.1.2` → `2.1.3` に同期、 description に「vendored Anthropic-official skill-creator + frontend-design」 を明記、 tags に `skill-creator` / `frontend-design` を追加

### Verified

- 全 skill (vendored 含む 20 個) に SKILL.md 存在を CI 相当の loop で確認
- 4.7-native forbidden phrase check: vendored exclude 適用後に `agents/` `skills/` `commands/` 全体 grep で 0 hit
- markdownlint: vendored ignore 適用後の exit code 0
- JSON validation: `.claude-plugin/plugin.json` / `marketplace.json` を Node.js で parse 検証 → pass

### Reference

- upstream: <https://github.com/anthropics/skills> (commit に固定せず latest main 取得、 今後の upstream patch は手動 sync)
- skill-creator description: 自前 skill を `examples/sample-project` で eval する用途で v2.2+ 検討余地
- frontend-design description: AI slop 回避のための typography / aesthetic direction 推奨

## [2.1.2] - 2026-05-12

**Anthropic 公式 best practice 適合性 fix + 4.7-native 1次情報ベース review 反映**。 Claude Code 2.1.139 で `claude plugin install pev-harness@pev-harness` が「This plugin uses a source type your Claude Code version does not support」 で失敗していた問題を含む、 公式 docs 4 ヶ所 schema 逸脱の修正に加え、 Opus 4.7 公式 1次情報 (B1 = [Anthropic blog 2026-04-16](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code), B3 = [Task budgets API docs](https://platform.claude.com/docs/en/build-with-claude/task-budgets), B4/B5 = Boris/Cat Wu 投稿) との直接照合を実施し、 SPEC の根拠と独自拡張の境界を明確化。 機能変更なしの patch。

### Fixed (Anthropic 公式 schema 逸脱 4 件)

- **`.claude-plugin/marketplace.json`** `plugins[0].source` を `"."` → `"./"` に変更 (公式 [plugin-marketplaces.md](https://code.claude.com/docs/en/plugin-marketplaces.md#relative-paths) で `"./"` から始まる相対 path が正規形、 `"."` は未サポート)。 これにより Claude Code 2.1.x で marketplace 経由 install が成功するようになる
- **`hooks/hooks.json`** PreToolUse Bash hook の input 読み取り方法を `$TOOL_INPUT` 環境変数 → **stdin JSON** (jq `.tool_input.command`) に修正 (公式 [hooks.md](https://code.claude.com/docs/en/hooks.md) 準拠)。 v0.x からの no-op だった destructive command 検知 (`rm -rf /` 等) が **実際に block** するようになる。 出力も `permissionDecision: "deny"` JSON 形式に変更
- **`settings.json`** トップレベルの `"permissionMode": "default"` を `"permissions": {"defaultMode": "default"}` に修正 (公式 [settings.md](https://code.claude.com/docs/en/settings.md) で正規 key)、 これまで Gate A 制御の core 設定が **silently 無視されていた** 可能性を解消
- **`settings.json`** 公式に存在しない `"skillOverrides": "user-invocable-only"` field を削除。 代わりに skill 個別制御に移行: `pev-bootstrap-codex` / `pev-bootstrap-playwright` / `pev-bootstrap-project` の 3 つの one-time setup skill に `disable-model-invocation: true` を追加し、 Claude による意図しない auto-invoke を抑止

### Documented (4.7-native 1次情報ベース review 反映 / Priority 1-4)

**Priority 1 — 直接的な仕様ミスマッチの明示**:

- **`skills/pev-task-budget/SKILL.md`** description を「Claude Code surface で公式 Task budgets API は **非サポート** ([B3](https://platform.claude.com/docs/en/build-with-claude/task-budgets) で明記)、 prompt-level hint のみの暫定運用」 に書き換え、 冒頭に「⚠️ 公式仕様との関係」 セクションを追加 (引用文と限界を明示、 hard cap として期待する誤用を防止)

**Priority 2 — 公式と緊張関係のある記述を緩和 / 正当化**:

- **`rules/4.7-native.md`** に「公式 1次情報との関係」 セクション追加。 [B1](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code) は adaptive thinking 制御 hint としての "Think carefully and step-by-step" を **実は許容している** ことを引用付きで明記。 PEV-harness 内部の禁止は「prompt 本文での 4.6 時代 scaffolding の無自覚混入」 を防ぐ社内規約であり、 公式違反ではないと位置付け
- **`SPEC.md` ADR-008 新規追加**: 「なぜ Verifier の実行手順だけ hard-coded か」 — B1 「Treat Claude more like a capable engineer」 との緊張関係を「Verifier は engineer ではなく CI runner」 として正当化、 deterministic checklist 化の根拠を明記

**Priority 3 — 公式根拠の明示で正当性を補強**:

- **`SPEC.md` ADR-001 補強**: B1 「one-shot completion / delegation model」 と [B5 (Cat Wu)](https://x.com/_catwu/status/2044808533905178822) Tip 2 「Give Claude Code your full task context upfront: goal, constraints, acceptance criteria in the first turn」 を直接引用、 3-phase 構造の公式根拠を強化
- **`SPEC.md` ADR-006 前文追加**: codex CLI 統合は「4.7-native best practice に直接根拠を持たない PEV-harness 独自拡張」 と明記、 dual-codex の model diversity 仮説が社内独自であることを期待値調整
- **`SPEC.md` §4 Phase 2 並列ガイダンス**: B1 「Spawn multiple subagents in the same turn when fanning out across items or reading multiple files」 引用付きで明文化、 **default は直列 1**、 fan-out / independent items 明示時のみ並列 (上限 3) と整理
- **`SPEC.md` §4 Phase 1/3 model+effort**: 各 phase の `xhigh` / `high` 配分 を B1 引用 (「intelligence-sensitive tasks」 / 「Balances intelligence and cost」 / 「The best setting for most coding」) と直接対応

**Priority 4 — 経験則と 1次情報の境界明示**:

- **`SPEC.md` §1 P1-P5 表の直後**に「1次情報根拠」 table 追加、 各原則の B1/B3/B4/B5 対応を明示。 P1 / P4 は「独自原則」、 P2 / P5 は「公式根拠あり、 ただし実装手段は独自」 と整理
- **`SPEC.md` P3 注記**: Claude Code v2.1.111+ は社内検証値、 公式 1次情報に具体的 version の記載なし
- **`SPEC.md` §4 Retry=3**: 経験則、 1次情報根拠なしと明示
- **`SPEC.md` §6 effort experimentation note**: B1 「experimenting with effort rather than just porting over an old setting」 推奨を反映、 default xhigh は出発点扱い

### Changed

- **`.claude-plugin/plugin.json`** / **`.claude-plugin/marketplace.json`** version を `2.1.0` → `2.1.2` に同期 (v2.1.1 タグ commit で manifest version 更新が漏れていた状態の解消も兼ねる)
- **`README.md`** version badge を `2.0.0` → `2.1.2` に更新 (CHANGELOG / plugin.json と integrity 揃え)
- **`SPEC.md` §11 ロードマップ table** に v2.1.2 row 追加 (status: current)、 v2.1.1 を ✅ released へ移動
- **`SPEC.md` §6 settings.json snippet** を v2.1.2 で 公式 schema 準拠化した形に書き換え

### Verified

- JSON validation: `.claude-plugin/plugin.json` / `.claude-plugin/marketplace.json` / `hooks/hooks.json` / `settings.json` を Node.js で parse 検証 → all pass
- 4.7-native forbidden phrase check: `agents/` `skills/` `commands/` 全体 grep で 0 hit (rules/ への "step-by-step" 言及は CI 対象外)
- 1次情報出典: 公式 docs (claude.com/blog, platform.claude.com, code.claude.com) を最優先ソースとし、 1次情報で明示なしの事項は「経験則」「社内検証値」「独自拡張」 と明記して期待値を調整

### Reference

- **Anthropic 公式 1次情報 (4.7-native)**:
  - [B1: Best practices for using Claude Opus 4.7 with Claude Code (2026-04-16)](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code)
  - [B2: What's new in 4.7](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7)
  - [B3: Task budgets API docs](https://platform.claude.com/docs/en/build-with-claude/task-budgets)
  - B4/B5: Boris Cherny / Cat Wu 投稿 (2026-04-16)
- **Anthropic 公式 schema docs**: [plugin-marketplaces.md](https://code.claude.com/docs/en/plugin-marketplaces.md) / [hooks.md](https://code.claude.com/docs/en/hooks.md) / [settings.md](https://code.claude.com/docs/en/settings.md) / [skills.md](https://code.claude.com/docs/en/skills.md)

## [2.1.1] - 2026-05-12

**Plugin Marketplace 配布対応** + plugin.json version 同期。 v2.1 機能変更なし、 配布経路整備のみの patch。 `claude plugin marketplace add myksyut/pev-harness` → `claude plugin install pev-harness@pev-harness` で導入可能になる。

### Added
- `.claude-plugin/marketplace.json` 新規追加 (1-repo パターン、 `plugins[0].source = "."`)
- ONBOARDING.md §1 に Plugin Marketplace 経由インストール手順 (経路 A)、 既存手動 clone 方式を経路 B として併記

### Changed
- `.claude-plugin/plugin.json` の `version` を `0.1.0` → `2.1.0` に同期 (これまで release ごとに更新されていなかった、 v2.1+ marketplace 経由 install で正しい version が surface される)
- `CLAUDE.md` §5 release procedure に plugin manifest version 同期 step を明示追加 (今後の release で必須化)
- `README.md` Quickstart の plugin install snippet を marketplace 経由優先に書き換え (手動 clone も併記)

### Note
- 既に `~/.claude/plugins/repos/myksyut/pev-harness` に clone 済みのユーザーは、 そのまま `git pull` で v2.1.1 を取得すれば OK。 marketplace 経由 install への切替は任意

## [2.1.0] - 2026-05-12

**`empirical-prompt-tuning` skill 取り込み + `skill-finder` 撤去**。 上流 [mizchi/skills](https://github.com/mizchi/skills/tree/main/empirical-prompt-tuning) の SKILL-ja.md (commit `0b197be`) を pev-harness に正規取り込み。 v0.1.1 で外部 skill 評価メタスキルとして導入していた `skill-finder` を撤去し、 「subagent dispatch + 自己申告 + 指示側メトリクスで反復改善」の方法論に置換。 pev-pipeline / pev-spec-template 等の中核 skill を体系的にチューニングする土台。

### Added

**`skills/empirical-prompt-tuning/SKILL.md`** (日本語版を採用):
- Iteration 0 (description / body 整合チェック、 dispatch 不要) → baseline 準備 → bias-free subagent dispatch → 両面評価 (自己申告 + `tool_uses`/`duration_ms`) → 差分適用 → 再評価 → 収束判定の 7 step
- 評価軸 7 種 (成功/失敗、 精度、 ステップ数、 duration、 retries、 不明瞭点、 裁量補完) と重み付け方針 (質的を主、 量的を補助)
- subagent 起動契約 (Target prompt / Scenario / Requirements checklist / Task / Report structure を固定フォーマットで渡す)
- 失敗パターン台帳 (per-target-prompt の累積記録、 同クラスの誤り再発見を防ぐ)
- バリアント探索 (Conservative + Exploratory、 plateau-breaking 用、 default 不使用)
- Red flags 表 (self-reread / 1 シナリオ / 単発 zero / 一括修正 / 同 subagent 再利用 等の rationalization に対する反論)
- 出典セクション: `mizchi/skills` `0b197be` を明示

### Removed

- **`skills/skill-finder/SKILL.md`** — v0.1.1 で導入した外部 skill 評価メタスキル。 上位互換である empirical-prompt-tuning (汎用プロンプト改善方法論) に役割吸収。 SPEC.md §7 と guide/CHECKLIST.md の言及も整理

### Changed

- **`SPEC.md`** §7 (Skills 一覧) に empirical-prompt-tuning row 追加
- **`SPEC.md`** §11 ロードマップ table を v2.1 = empirical-prompt-tuning、 v2.0 を ✅ released へ更新、 Gemini CLI を v2.2+ へ後送り
- **`README.md`** Components 表の skills count を `(17)` → `(18)` に整合化、 skill-finder を empirical-prompt-tuning に置換
- **`guide/CHECKLIST.md`** v0.1.1 当時の skill リストに撤去/置換注記を追加 (履歴保持目的)

### Verified

- 静的整合チェックのみ (取り込んだ skill 本体の dog food は別 session で pev-pipeline / pev-spec-template を対象に実施予定)
- 4.7-native forbidden phrase check: `step.by.step` / `double.check` / `be thorough|careful|take.your.time` を `agents/` `skills/` `commands/` 全体に grep して 0 hit を確認
- JSON validation: `.claude-plugin/plugin.json` / `hooks/hooks.json` / `settings.json` / `schemas/*.json` を Node.js で parse 検証

## [2.0.0] - 2026-05-12

**External reviewer (OpenAI Codex CLI) 統合** で真の model diversity を実現。 v1.x までは `pev-dual-review` が claude 単独 (Opus + Sonnet alias) だったが、 v2.0 では Reviewer B を **OpenAI Codex CLI subprocess** に切替可能。 異 vendor (Anthropic + OpenAI) で training corpus / RLHF policy / tokenization の独立性を確保し、 blind spot 共有を低減。

### Added

**`/pev-init-codex` command** + **`skills/pev-bootstrap-codex/SKILL.md`**:
- codex CLI install 確認 (`npm i -g @openai/codex` or `brew install --cask codex`)
- 認証状態確認 (`codex login status`): subscription auth (`codex login` でブラウザ sign-in) または API key auth (`OPENAI_API_KEY` を `codex login --with-api-key` で取り込み) のどちらか effective ならOK
- `codex exec --json --skip-git-repo-check "ping"` で sanity test
- v1.4 pev-bootstrap-playwright + v1.9 pev-bootstrap-project と並列の sibling

**`skills/pev-external-reviewer/SKILL.md`**:
- codex を Reviewer として subprocess invoke する skill
- 起動 command: `timeout ${PEV_CODEX_TIMEOUT:-300}s codex exec --json --output-schema <schema> -o <out.json> --ephemeral --sandbox workspace-write "<prompt>"`
- prompt: git diff + plan.md AC + rubric を概念的に組み立て stdin pipe + 引数で渡す
- output: `schemas/codex-reviewer-output.json` で JSON 構造を強制、 verifier 側で parse + merge
- fallback: codex 不在 / timeout / non-zero exit → 自動で `dual-claude` に degrade、 `verify.json.fallback_reason` 記録

**`schemas/codex-reviewer-output.json`** (新規):
- reviewer JSON 構造を公式 schema 化 (verdict / critical_issues / suggestions / ac_coverage)

### Changed

**`skills/pev-dual-review/SKILL.md`**:
- Reviewer B が claude-sonnet (現状) / codex (v2.0 新規) のどちらかを選択可能に
- `PEV_REVIEWER_MODE` 環境変数または `--reviewer-mode=<mode>` flag で切替
- 4 mode: `claude-only` (default) / `dual-claude` (旧 --strict) / `dual-codex` (v2.0 新規) / `codex-only` (v2.0 新規)

**`agents/verifier.md`**:
- reviewer choice dispatch logic 追加 (PEV_REVIEWER_MODE で `pev-external-reviewer` / `pev-dual-review` / claude-single の分岐)
- verify.json schema 拡張: `reviewer_mode` / `reviewers[]` (provider / verdict / raw_output) / `fallback_reason`

**`settings.json`**:
- env に `PEV_REVIEWER_MODE` (default: `claude-only`) / `PEV_CODEX_TIMEOUT` (default: `300`) / `PEV_CODEX_BIN` (default: `codex`) / `PEV_CODEX_SANDBOX` (default: `workspace-write`) を追加

**`SPEC.md`**:
- §10 Dual Review を v2.0 拡張 (4 mode 表 + codex 技術詳細 + model diversity 改善の言及)
- §11 ロードマップ table に v2.0 row 追加
- §12 ADR-006 (subprocess vs MCP の選択理由) + ADR-007 (Reviewer A が claude 固定の理由) 追加

**`README.md`** / **`ONBOARDING.md`**:
- Components 表に v2.0 新 skill / command 追加
- ONBOARDING に「外部 reviewer (codex) セットアップ」 section 新規 (4 step: install / API key / `/pev-init-codex` / `/pev <task> --reviewer-mode=dual-codex`)
- fallback 動作の説明明記

### Verified via dog food
- 環境: codex CLI v0.128.0 (`/etc/profiles/per-user/.../bin/codex`、 ChatGPT subscription auth = `Logged in using ChatGPT`)
- Sanity test: `codex exec --json --skip-git-repo-check --ephemeral --sandbox workspace-write "Reply with 'pong'"` → `{"item":{"text":"pong"}}` を含む JSONL (latency 数秒、 token usage 表示)
- 実用 dog food (sample-project に 1 行 marker comment 追加、 AC2 違反シナリオ): `codex exec --json --output-schema schemas/codex-reviewer-output.json -o out.json --ephemeral --sandbox workspace-write --skip-git-repo-check <prompt>` → schema 準拠の structured JSON を返した:
  - `verdict: "FAIL"` + `critical_issues[0]` で AC2 違反を指摘 + `suggested_fix` 付き
  - `ac_coverage[]` で AC1 met / AC2 not-met を evidence 引用付きで分離記録
  - 日本語 AC ("コードが既存のテストを破壊しない") を正しく理解
- dog food findings (release 前に patch 済):
  - **F1**: macOS default で `timeout` コマンド不在 → `pev-external-reviewer` の Invocation pattern に portable wrapper (`timeout` → `gtimeout` → no-op fallback + warning) を明文化
  - **F2**: OpenAI structured outputs strict 仕様で **全 properties が required 必須**、 optional は型 null 許容で表現 → `schemas/codex-reviewer-output.json` を strict 準拠に書き直し、 SKILL.md に「Schema strict 仕様」 section 追加
  - **F3** (環境誤認、 release 前訂正済): 認証は `CODEX_API_KEY` env var ではなく **`codex login` (subscription auth) または `OPENAI_API_KEY` + `codex login --with-api-key`** が v0.128 で正。 spec / skill / commands / ONBOARDING を 2 path 対応に訂正
  - **F4** (環境 finding、 spec 修正対象外): `codex review` subcommand (`--uncommitted` / `--base` 等) は code review 専用だが `--json` / `--output-schema` を支持しないため、 PEV 用途では `codex exec` を採用

### Design rationale (詳細 SPEC.md §12 ADR-006 / ADR-007)
- ADR-002 (v0.4) で「外部 CLI 依存をやめた」 と書いた経緯を踏まえつつ、 v2.0 では `codex exec --json --output-schema` が公式 sanctioned で **schema 強制が JSON parse risk を消す** ため subprocess + on-demand 起動を採用
- MCP server 化された codex が public spec として安定したら v2.x で MCP path を併設検討

## [1.9.0] - 2026-05-12

**`/pev-init` project bootstrap command** 追加。 ONBOARDING.md §2 で手動 cp + edit + gitignore append の 5 step だった project 導入手順を、 言語検知付き 1 コマンドに圧縮。

### Added

**`/pev-init [--dry-run] [--force]` command** (`commands/pev-init.md`):
- 新規 project に pev-harness を導入する one-time setup を 1 コマンドで完結
- 言語/構成 検知 (`package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml` / `playwright.config.*`) → `team-conventions.md` の `## Verification commands` 4 項目を auto-populate
- `--dry-run`: 「実行予定 file list + 検知結果 + 質問 preview」を stdout 出力して exit、 実 I/O なし
- `--force`: interactive prompts を skip、 default 上書き (CI / 自動化用)

**`skills/pev-bootstrap-project/SKILL.md`**:
- 既存 `pev-bootstrap-playwright` と並列の bootstrap skill family
- 5-7 step: preflight → 言語検知 → template populate → AskUserQuestion 経由 interactive prompts → file write → 結果サマリ
- 生成 file (default): `team-conventions.md` skeleton (v1.8 必須項目 含む) / `.gitignore` に `artifacts/` 追記
- 生成 file (interactive yes/no): `.linear-config.yml.example` copy / `.claude/settings.local.json` 雛形 / `~/.claude/pev/team-conventions.local.md` (個人 override skeleton)
- 既存 file 衝突: AskUserQuestion で「上書き / merge / skip」分岐、 `--force` で skip 化

### Changed

- `examples/team-conventions.example.md`: v1.8 で必須化した `## Verification commands` 4 項目を template に反映、 言語非依存 skeleton 化 (30 行 minimum + 「拡張 section の例」 comment)
- `ONBOARDING.md` §2: 「プロジェクトへの導入」を `/pev-init` 1 コマンドベースに書き換え (5 step → 2 step)
- `README.md` Quick Start: 「install → /pev-init → /pev」 の 3 step に圧縮
- `SPEC.md` §7 (Skills): `pev-bootstrap-playwright` (v1.4 で導入されていたが未掲載) と `pev-bootstrap-project` を表に追加
- `SPEC.md` §8 (Commands): `/pev-init` / `/pev-init-e2e` / `/pev-verify-e2e` を表に追加

### Verified via dog food
- fresh project (`/tmp/v19-init-test/`) で /pev-init を 4 シナリオ実機 invoke (Node `--dry-run` / Node `--force` 初回 / Node `--force` 再 invoke / Python `--force`)
- 結果:
  - **Node `--force` 初回**: ✅ 完璧。 `package.json` scripts.test=`vitest run` / scripts.lint=`eslint .` / scripts.typecheck=`tsc --noEmit` を全検知し、 `team-conventions.md` の `## Verification commands` に `Unit test: npm test` / `Lint: npm run lint` / `Typecheck: npm run typecheck` / `E2E test: 未設定` で正しく populate。 `.gitignore` 新規作成 (`artifacts/` 1 行) + `.linear-config.yml.example` copy + `.claude/settings.local.json` (`{"permissionMode": "default"}`) 雛形 すべて生成
  - **Python `--force`**: ✅ 完璧。 `pyproject.toml` の `requires-python` / `tool.pytest` / `tool.ruff` / `tool.mypy` を検知し、 `Unit test: pytest` / `Lint: ruff check .` / `Typecheck: mypy .` / Language: Python / Runtime: Python >= 3.11 を populate
- dog food findings (release 前に patch 済):
  - **F1**: `--dry-run` / `--force` 後 subprocess Claude が「preview/summary 出力済み」と自然言語で返すだけで、 stdout に full preview/summary block を流していなかった → SKILL.md Step 6/7 に「assistant 最終応答テキスト = subprocess stdout として full block を必ず出力、 自然言語 summary 単独は規約違反」を明示
  - **F3**: `--force` で再 invoke しても、 既存 file が v1.8+ template と一致する場合 idempotent skip が優先され上書きされなかった → SKILL.md Step 1 + commands/pev-init.md で `--force` が idempotent skip を bypass する仕様を明文化
- 環境 finding (spec 修正対象外、 記録のみ):
  - **F4**: 2 並列 subprocess 起動時、 実 task は完了済 (file 生成完了) でも subprocess が 28+ 分 hang する現象を観測。 並列 init は MCP cleanup race の疑い、 user 側では `/pev-init` を順次起動することを推奨

### Design rationale
- v1.4 で `/pev-init-e2e` + `pev-bootstrap-playwright` の pattern が確立、 v1.9 で「**bootstrap skill family**」 として一般化
- v1.8 で `## Verification commands` を必須化した流れで、 init 時に言語検知で auto-populate することが natural な次手
- `--dry-run` mode は SPEC.md ADR-005 「Hook-driven verification」 と同じ思想で、 destructive 操作前の preview を user に保証する

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
