# pev-harness 確認チェックリスト

ユーザーが後で確認するためのリスト。Claudeが自律で進めた v0.1.0 + 周辺整備に対するレビュー観点。

> 全項目を必ず確認する必要はない。気になるところだけ。

---

## 0. 基本情報

- リポジトリ: <https://github.com/myksyut/pev-harness> (private)
- ローカル: `~/pev-harness/`
- バージョン: v0.1.1 (初期 skeleton + 周辺整備 + dog food検証 + skill-finder追加)
- ファイル数: 約 44 (Claude生成、source-of-truth は SPEC.md)
- skills: **9個** (pev-pipeline, pev-spec-template, pev-task-budget, pev-focus-mode, pev-recap, pev-subagent-memory, pev-dual-review, pev-team-conventions, **skill-finder**)

---

## 1. ファイル構造の確認

```bash
cd ~/pev-harness && find . -type f -not -path './.git/*' -not -path './node_modules/*' | sort
```

期待される構成:

- [ ] `.claude-plugin/plugin.json` — plugin manifest
- [ ] `.github/workflows/ci.yml` — CI (markdownlint + JSON validation + forbidden phrase check)
- [ ] `.gitignore` — artifacts/ 除外
- [ ] `.markdownlint.json` — lint config
- [ ] `agents/*.md` — 3 files (planner, executor, verifier)
- [ ] `skills/*/SKILL.md` — 8 files
- [ ] `commands/*.md` — 5 files
- [ ] `hooks/hooks.json` — 3 hooks
- [ ] `rules/*.md` — 3 files (pev-conventions, 4.7-native, error-patterns)
- [ ] `examples/` — 9 files (各 phase の example artifact + sample-project)
- [ ] `guide/` — `CHECKLIST.md` (このファイル) / `ROLLOUT-CHECKLIST.md` / `FEEDBACK-TEMPLATE.md` / `dogfood-v1.3-report.md` / `TEST-PLAN-linear-v1.3.md`
- [ ] root: `SPEC.md` / `README.md` / `CLAUDE.md` / `ONBOARDING.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `SECURITY.md` / `LICENSE` / `settings.json`

---

## 2. 設計判断のレビュー (SPEC.md)

`SPEC.md` を一読して、以下の判断に違和感がないか確認:

- [ ] **§1 設計原則 P1-P5**: ミニマル維持、4.7-native、No backwards compat、Convention over configuration、Hook-driven
- [ ] **§4 Phase Gates**: Gate A (permissionMode判定)、Gate B (Stop hook)、Retry Gate (最大3回)
- [ ] **§6 settings.json**: model=opus-4-7, effort=xhigh, permissionMode=default (安全側) で良いか
- [ ] **§7 Skills 8つ**: 過不足ないか
- [ ] **§10 Dual Review**: Claude単独 model alias (A=Opus / B=Sonnet) で OK か
- [ ] **§11 ロードマップ**: v0.2 → v1.0 → v2.0 のマイルストーン妥当性
- [ ] **§12 ADR**: 5つの設計判断ログ

---

## 3. agents/ プロンプトのレビュー

各 agent の prompt に違和感がないか:

- [ ] `agents/planner.md` — Opus xhigh、入力契約 (Goal/Constraints/AC) 、出力契約 (artifacts/plan.md)
- [ ] `agents/executor.md` — Sonnet high、並列化ルール、subagent memory 規約
- [ ] `agents/verifier.md` — Sonnet xhigh、hard-coded実行手順、FAIL時の挙動

特に: 「You are a senior ...」「step by step」「double-check」等の 4.6 scaffolding が**残っていない**こと。

---

## 4. skills/ の網羅性レビュー

各skillが何をするかを把握:

- [ ] `pev-pipeline` — メインフロー、phase間の受け渡し、artifacts規約
- [ ] `pev-spec-template` — 初回プロンプト雛形、質問返し
- [ ] `pev-task-budget` — task_budget API、phase別予算
- [ ] `pev-focus-mode` — /focus推奨ロジック
- [ ] `pev-recap` — recap.log への書き込み
- [ ] `pev-subagent-memory` — ~/.claude/pev/{task_id}/ 規約
- [ ] `pev-dual-review` — --strict時のReviewer A/B並列
- [ ] `pev-team-conventions` — team-conventions.md自動注入

---

## 5. hooks/hooks.json の動作レビュー

`hooks/hooks.json` の3 hookを確認:

- [ ] **PreToolUse (Bash)**: `rm -rf /`, `rm -rf ~`, `git push --force.*main`, `git reset --hard.*origin/main` を block
- [ ] **Stop**: plan.md + execute.log がある & verify.json がない時に `/pev-verify` 促し
- [ ] **SessionStart**: `artifacts/.task_id` 存在検出で復旧メッセージ

懸念: macOS で `openssl` がない環境 (古いcommand line tools等) → フォールバックあり (`$RANDOM` 利用)。

---

## 6. commands/*.md の実装レビュー

`commands/*.md` 内に Bashブロックを埋め込んだ:

- [ ] `commands/pev.md` — task_id発行、permissionMode検出、Retry Gateロジック
- [ ] `commands/pev-plan.md` — task_id継続/発行、retry時の入力統合
- [ ] `commands/pev-execute.md` — pre-check、並列化判定、Stop hook trigger
- [ ] `commands/pev-verify.md` — verifier起動、--strict分岐、最終report生成
- [ ] `commands/pev-status.md` — default/--clean/--escalate の3モード

懸念: Claude Code がBashブロックを「ヒント」として解釈するか、「リテラルに実行」するかは v2.1.x 実装依存。dog foodで挙動を観察すべき。

---

## 7. examples/ の有用性レビュー

dog food前の参考資料:

- [ ] `examples/plan.example.md` — リアリスティックな plan.md
- [ ] `examples/execute.example.log` — Phase 2 ログ例
- [ ] `examples/verify.example.json` — PASS例
- [ ] `examples/verify.fail.example.json` — FAIL→retry例
- [ ] `examples/recap.example.log` — 全phase完了の recap
- [ ] `examples/team-conventions.example.md` — テンプレ
- [ ] `examples/sample-project/` — 動くdog food用ミニプロジェクト (add関数のTODO)

---

## 8. CI workflow (.github/workflows/ci.yml)

GitHub Actions が以下を自動チェック:

- [ ] markdownlint (`*.md` 全部、`.markdownlint.json` 設定)
- [ ] JSON parse validation (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `settings.json`)
- [ ] plugin.json の必須フィールド (`name`, `version`, `description`)
- [ ] forbidden 4.6-style scaffolding check (`agents/` `skills/` `commands/` 配下)
- [ ] 必須ファイル存在チェック
- [ ] 全 skill に SKILL.md があること

push後、 https://github.com/myksyut/pev-harness/actions で初回CI結果を確認。

---

## 9. ドキュメントの品質

- [ ] `README.md` — 公開向け説明、quickstart、ロードマップ
- [ ] `CLAUDE.md` — Claude Codeが読むplugin規約
- [ ] `ONBOARDING.md` — 社内展開ガイド (8セクション)
- [ ] `CHANGELOG.md` — v0.1.0 リリースノート + Unreleased
- [ ] `CONTRIBUTING.md` — 開発者向けガイド
- [ ] `SPEC.md` — 完全仕様 (12章 + ADR 5件)

---

## 10. dog food 試走

### 10-0. 自動実施済み (v0.1.1, headless実行)

`claude --plugin-dir ~/pev-harness --print '/pev-harness:pev "Implement add(a,b)..."'` を `examples/sample-project/` で実行した結果:

- ✅ **Phase 1 (Plan)**: `artifacts/plan.md` 高品質生成
  - Goal / Constraints / Acceptance Criteria 全部
  - team-conventions.md を参照 ("Follow team-conventions.md")
  - **Estimated task budget: ~2k tokens** (pev-task-budget skill 機能確認)
  - 独自で **Non-goals** セクション追加 (planner judgement働いた)
- ✅ **Phase 2 (Execute)**: `src/index.js` が `return a + b;` に正しく書き換えられた + `execute.log` 記録
- ✅ **Acceptance Criteria 達成**: `npx vitest run` で 2/2 tests passed
- ⚠️ **Phase 3 (Verify) は手動実行が必要**: `verify.json` 自動生成されず (Stop hook が headless環境で発火しなかった)
- ⚠️ **recap.log なし** (pev-recap skillの自動起動が効いていない、Issue #4)
- ⚠️ **subagent memory 空** (`~/.claude/pev/{task_id}/` が空、Issue #2と関連)

確認できた事実: **agentレベルの動作は完全に意図通り**、ただし周辺自動化 (hooks / recap書き込み / memory書き込み) は v0.2-v0.3 でフィックス必要。

実行成果物 (確認用):
- `examples/sample-project/artifacts/plan.md` (1658 bytes、高品質)
- `examples/sample-project/artifacts/execute.log` (120 bytes)
- `examples/sample-project/src/index.js` (executor成果)

### 10-1. 手動 dog food 試走 (オプション)

別端末で実際に動かして確認するチェックリスト:

#### 10-1A. 起動確認

```bash
cd ~/pev-harness/examples/sample-project
npm install   # vitest だけ入る
claude --plugin-dir ~/pev-harness
```

- [ ] Claude Code が起動して `pev-harness` plugin を認識する (`/plugins list` で確認)
- [ ] `/help` で `/pev-harness:pev` 等が表示される

#### 10-1B. /pev-plan 単独

```
/pev-harness:pev-plan "Implement add(a, b) to return a + b in src/index.js, add edge case tests"
```

期待される挙動:

- [ ] `pev-spec-template` skill が起動し、ACなどが揃っていれば planner 直接起動
- [ ] `artifacts/plan.md` が生成される
- [ ] `artifacts/.task_id` が生成される
- [ ] `~/.claude/pev/{task_id}/` ディレクトリが作られる
- [ ] `artifacts/recap.log` に Phase 1 エントリ追記

#### 10-1C. /pev-execute 単独

```
/pev-harness:pev-execute
```

期待される挙動:

- [ ] `artifacts/plan.md` を読んで実装する
- [ ] `src/index.js` の TODO が解消される
- [ ] `tests/index.test.js` が変更/追加される
- [ ] `artifacts/execute.log` 追記
- [ ] Stop hook で `/pev-harness:pev-verify` 促し表示

#### 10-1D. /pev-verify 単独

```
/pev-harness:pev-verify
```

期待される挙動:

- [ ] `npm test` が走る
- [ ] `artifacts/verify.json` に verdict + checks + acceptance_criteria が書かれる
- [ ] PASS なら完了表示、FAIL ならretry誘導

#### 10-1E. /pev フル (auto mode)

```bash
# 個人settings.local.jsonでpermissionMode=autoに切替
# その後
/pev-harness:pev "Implement add(a, b)..."
```

期待される挙動:

- [ ] Gate A がスキップされて Phase 2 へ自動進行
- [ ] 全phaseが連続実行される
- [ ] 最終的に PASS で artifacts/recap.log に完了エントリ

#### 10-1F. --strict モード

```
/pev-harness:pev-verify --strict
```

期待される挙動:

- [ ] Reviewer A (Opus xhigh) と Reviewer B (Sonnet high) が並列起動
- [ ] 両者の verdict がmergeされる

---

## 11. 既知の懸念点

dog food (10-0) で確認できたものを更新:

- ✅ **解消**: Skill 名前空間は `/pev-harness:pev` で正しく動作
- ✅ **解消**: agent frontmatter で `effort: xhigh` が公式サポートされている (v0.1.1で追加済み)
- ⚠️ **要対応 (Issue #4)**: Stop hook が headless 環境で発火しない → Phase 2 → Phase 3 自動移行が確実でない
- ⚠️ **要対応 (Issue #4)**: recap.log の自動書き込みが効いていない
- ⚠️ **要対応 (Issue #2)**: subagent memory `~/.claude/pev/{task_id}/` への書き込みが行われていない
- ⚠️ **未検証**: `task_budget` の API beta header passthrough → planner が "Estimated task budget" を出している事実から少なくとも skill 認識はOK、実 API へのpassthrough は要追加検証 (Issue #3)
- ⚠️ **未検証**: hooks/hooks.json の `deny-pattern` type は擬似コード → 実際のClaude Code hook schema要確認

---

## 12. v0.2 への次のアクション

GitHub Issues に登録済み (9件、`gh issue list` で確認):

| # | Title | Target |
|---|---|---|
| [#1](https://github.com/myksyut/pev-harness/issues/1) | Auto Mode integration: detect permissionMode for Gate A | v0.2 |
| [#2](https://github.com/myksyut/pev-harness/issues/2) | task_id lifecycle: cleanup hooks and stale detection | v0.2 |
| [#3](https://github.com/myksyut/pev-harness/issues/3) | task_budget API beta header passthrough | v0.3 |
| [#4](https://github.com/myksyut/pev-harness/issues/4) | pev-recap auto-write integration with all phase agents | v0.3 |
| [#5](https://github.com/myksyut/pev-harness/issues/5) | pev-dual-review: parallel Reviewer A/B with structured JSON merge | v0.4 |
| [#6](https://github.com/myksyut/pev-harness/issues/6) | pev-team-conventions: auto-injection wiring | v0.5 |
| [#7](https://github.com/myksyut/pev-harness/issues/7) | Internal team rollout to 3 teams + collect feedback | v1.0 |
| [#8](https://github.com/myksyut/pev-harness/issues/8) | pev-linear-sync skill: bidirectional Linear Issue sync | v1.1 |
| [#9](https://github.com/myksyut/pev-harness/issues/9) | External model support via MCP server (OpenAI/Gemini) | v2.0 |

---

## 13. Ownership transfer (任意)

別 organization に移したい場合は `gh repo transfer <owner>/pev-harness <new-org>` で可能。 transfer 後はローカル remote URL の更新が必要 (`git remote set-url origin ...`)。

OSS contributor 観点では transfer 時に URL change が起きるので、 README / docs / バッジ URL の grep & update を忘れずに。

---

## 確認後のフィードバック方法

- 軽い指摘: GitHub Discussion または直接連絡
- 構造的な変更が必要: 該当 Issue にコメント、または新規 Issue 作成
- 設計判断レベルの変更: SPEC.md §12 に新規 ADR として追加してから実装
