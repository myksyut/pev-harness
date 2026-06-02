# CLAUDE.md — pev-harness 開発者向け context

このファイルは **pev-harness 自体を develop する Claude Code session** が auto-inject される context。 plugin として install された側 (= user の project) は **このファイルを読まない**。 plugin user 向け説明は [README.md](./README.md) / [ONBOARDING.md](./ONBOARDING.md) 参照。

## 0. このリポジトリは何か

Claude Opus 4.8 native の **(Triage →) Plan → Execute → Verify (PEV) coding harness** Claude Code plugin。 v0.1 → v3.0.1 (現在) まで dog food 駆動で漸進的に成長させてきた。 v1.0 で OSS public 化済 (<https://github.com/myksyut/pev-harness>)。

**v3.0 で根本見直し済**: ハーネスの value proposition を「user の頭の中の spec を引き出す」 に再定義。 v2.x までは Plan を必ず起動する 3-phase pipeline だったが、 v3.0 で Phase 0 (Triage) を新設、 Plan を on-demand 化、 質問判定強化、 F1 Defensive default の scope 限定 を実施。 詳細: [experiments/v3.0-design.md](./experiments/v3.0-design.md) + [experiments/harness-effect-v1 to v5](./experiments/) の 5 件の根拠実験。

## 1. 開発スタイル: dog food 駆動 spec evolution

**ループ構造**:

```text
[1 集中 feature を spec 化] → [skills/agents/commands 実装]
        ↓
[examples/sample-project/ で dog food (実機 invoke)]
        ↓
[findings 抽出 → CHANGELOG.md docs に記録]
        ↓
[次 release で findings を spec に反映]
        ↓ (繰り返し)
```

**実例**:

| Release | feature | dog food | findings → 次 release |
|---|---|---|---|
| v0.5 | team-conventions auto-injection | sample-project add | Gate A leak 発覚 → v0.6 |
| v0.6 | Gate A enforcement (3層防御) | sample-project re-run | clean |
| v1.3 | Linear hardening | TES-1/TES-2/TES-3 + 2 projects | **28 findings**、 H4+M5 反映済 |
| v1.4 | Playwright E2E | sample-project E2E fixture | clean、 spec correction (.github/ → .claude/agents/) |
| v1.5 | QA technique integration | (combined with v1.4) | — |
| v1.4+v1.5 | multiply task | TES-4 | **5 findings (F1-F5)** → v1.6 |
| v1.6 | F1-F5 反映 | sample-project reset | clean |
| v2.x | Linear / Codex / scope install 等の追記強化 | (累積) | dog food 中心 |
| **v2.1.6** | **harness-effect-v1 dog food**: WebSocket chat | F1 Defensive default + F2 DRY self-review | released |
| **v3.0** | **大型再設計**: Triage 新設 + Plan on-demand + 質問判定強化 + F1 scope 限定 | harness-effect-v1/v2/v3/v4 (4 件) で根拠提示、 v3-dogfood で再現性確認 | released |
| **v3.0.1** | **harness-effect-v5 dog food**: 申込キャンセル機能 | F_v5_1 (pattern 踏襲指示でも dialog 等は質問必須) | (current) |

**重要**: dog food は **実機 invoke** が原則。 spec review のみで release しない (v1.2 の Linear sync は dog food 未実施で、 v1.3 で 28 findings が一気に出た)。

## 2. 絶対遵守の規約

### 2.1 4.X-native (禁止フレーズ)

`agents/` / `skills/` / `commands/` に以下を **書かない**:

- `step by step` / `Let's think step by step`
- `double-check` / `verify your output`
- `be thorough` / `be careful` / `take your time`

理由: Opus 4.X は adaptive thinking で自動実施、 明示は逆効果。 CI で `Check for forbidden 4.6-style scaffolding` step が grep で検出 → fail。 詳細: [rules/native-prompting.md](./rules/native-prompting.md)。

### 2.2 Gate respect ([rules/pev-conventions.md §0](./rules/pev-conventions.md))

- planner agent が `permissionMode=default` を override してはならない
- Gate A 判断は `commands/pev*.md` の責任、 agent はphase boundary を越えない
- user が override したい場合は v1.6+ の `--force-auto` flag (formal channel)
- **v3.0+**: Gate A は **Plan が起動された場合のみ**。 Triage agent が `plan_skip` 判定した task では Gate A は走らず、 直接 Execute → Verify。 `--with-plan` で v2.x 互換挙動を強制可能

### 2.3 Single source of truth

- 1 phase に 1 agent / 1 skill (重複させない)
- spec の正は **SPEC.md** (12章 + ADR)、 他 file は cross-reference
- `.linear-config.yml` は Linear 専用、 `team-conventions.md` は規約、 役割分離維持

### 2.4 conventional commits + Co-Authored-By

```text
feat(vX.Y): <短い summary>
fix(ci): <CI fail 修正>
chore(deps): <Dependabot>

<body, HEREDOC で multi-line>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## 3. dog food fixture (examples/sample-project/)

### 3.1 構造 (v1.7.1+ の form fixture)

```text
examples/sample-project/
├── src/validation.js     # 純関数 validators (validateName/Email/Phone/Plan/Agreement)
├── src/form.js           # submit handler + LocalStorage persistence + 二重送信防止
├── tests/validation.test.js  # 境界値 (空、 51 文字、 不正 email、 etc.) 網羅
├── tests/form.test.js    # mock storage + fake timer で submit flow / 二重送信 test
├── index.html            # 申込フォーム UI (accessible: label/aria-required/role=alert)
├── tests-e2e/seed.spec.ts   # Playwright 正常パス + 必須欠落 + email 不正 + 二重送信防止
├── playwright.config.ts  # webServer auto-start (http-server :8080)
├── vitest.config.js      # tests/ のみ scope (E2E と分離)
├── .claude/agents/       # Playwright agents (planner/generator/healer)
├── .mcp.json             # playwright-test MCP server config
├── .linear-config.yml    # workspace=emuni-kyoto, team.id=TES
└── team-conventions.md   # JS ESM + vitest + 2-space indent
```

**Domain**: イベント参加申込フォーム (氏名 / メール / 電話 / プラン / 利用規約同意)、 LocalStorage append、 二重送信防止、 accessibility 配慮。

### 3.2 Linear test data

| ID | Title | Status |
|---|---|---|
| Workspace | `emuni-kyoto` (URL slug) | — |
| Team | `test` (key: `TES`) | — |
| TES-1 | [PEV dog food] Implement add(a, b) | Done |
| TES-2 | [PEV dog food retry-exhaust] | Backlog (期待通り) |
| TES-3 | [PEV dog food child] Add subtract | Done |
| TES-4 | [PEV dog food v1.4+v1.5] Add multiply | Done |
| Projects | Good template / Bad template / 即時 deploy | — |

これらは累積的 test data。 cleanup は manual (`gh issue close` / `mcp__plugin_linear_linear__save_issue` で archived へ)。

### 3.3 dog food 手順 (v3.0+ stream-json input mode 推奨)

v3.0+ では `--input-format stream-json` で起動すると Triage 経由で planner が **質問返し可能**。 v2.x 互換 (text input + --print) では質問が skip されるため、 dog food で v3.0 効果を検証するなら stream-json 必須。

```bash
# (a) headless 実行 (= 効果検証 dog food)
SRC=~/oss/pev-harness/examples/sample-project
DEST=/tmp/v3-dogfood
rm -rf $DEST
rsync -a --exclude='node_modules' --exclude='artifacts' --exclude='playwright-report' --exclude='test-results' $SRC/ $DEST/
cd $DEST && npm install --silent

# v3.0 flow を invoke
PROMPT="/pev-harness:pev <task description>"
INIT=$(jq -nc --arg t "$PROMPT" '{type:"user",message:{role:"user",content:[{type:"text",text:$t}]}}')
echo "$INIT" | claude --plugin-dir ~/oss/pev-harness \
  --input-format stream-json --output-format stream-json --include-partial-messages \
  --permission-mode bypassPermissions --verbose --model claude-opus-4-8 -p \
  > /tmp/dogfood-turn1.log 2>&1
# Triage → (Plan ?) → Gate A (Plan あり時のみ) → Execute → Verify
# Plan で「## 確認質問」 が出たら、 同 cwd で claude --continue で次 turn を送る

# (b) 既存 sample-project で直接 (state accumulate)
cd ~/oss/pev-harness/examples/sample-project
claude --plugin-dir ~/oss/pev-harness   # interactive
# > /pev-harness:pev <task>            # default: Triage 経由
# > /pev-harness:pev <task> --with-plan # v2.x 互換 (Triage skip + 必ず Plan)
# > /pev-harness:pev <task> --no-plan   # Triage skip + 必ず plan-less Execute
# > /pev-harness:pev <task> --executor-mode=codex # Execute の実 file 編集を Codex CLI に委譲 (v3.5.0+)
```

**Codex executor mode (Execute phase 委譲) を verify する場合 (v3.5.0+)**: dog food subprocess は親環境の codex CLI / 認証 (`~/.codex/`) をそのまま使える (= Linear MCP と違い plugin ではなく独立 CLI のため、 `--mcp-config` 不要)。 codex 未認証の環境では Codex delegation mode は fallback path (= Claude native 実装に degrade) で動く。

**Linear path (Gate L / outbound sync) を verify する場合 (v3.3.0+)**:

dog food subprocess は親の Linear MCP 認証を継承しない (F_v16_1)。 Gate L の実 Linear write を verify するには:

```bash
# subprocess に Linear MCP を明示渡し
claude --plugin-dir ~/oss/pev-harness \
  --mcp-config '{"mcpServers":{"linear":{"url":"https://mcp.linear.app/mcp"}}}' \
  --input-format stream-json --output-format stream-json ...
# ※ Linear MCP の認証 (OAuth) が subprocess 側で別途必要
# 認証なしの場合 Gate L は degraded mode (= warning + skip、 pipeline は止めない) で動く
```

`.linear-config.yml` を dog food fixture に置く場合は workspace=emuni-kyoto / team.id=TES (累積 test data)。

**dog food 後は必ず reset**:

```bash
cd ~/oss/pev-harness/examples/sample-project
rm -rf artifacts/ playwright-report/ test-results/
# 追加 feature (multiply / inquiry 等) は手で削除して form fixture を初期状態に
# .linear-config.yml を置いた場合は削除 (= .example のみ commit する運用)
```

## 4. CI 構成 ([.github/workflows/ci.yml](./.github/workflows/ci.yml))

| Step | 内容 | 落とし穴 |
|---|---|---|
| markdownlint | `.markdownlint.json` の rule (緩和済) | MD029 (ol-prefix) / MD038 (no-space-in-code) / MD056 (table column) は disable していない、 守る必要 |
| JSON validation | `.claude-plugin/plugin.json` / `hooks/hooks.json` / `settings.json` / `schemas/linear-sync-state.json` / `examples/sample-project/.mcp.json` | parse error で fail |
| plugin.json schema | required: `name` / `version` / `description` | — |
| **Forbidden phrase check** | `grep -rE 'step.by.step\|double.check\|...' agents/ skills/ commands/` | `agents/` / `skills/` / `commands/` 配下のみ対象、 README/CHANGELOG/docs は exempt |
| 必須 file 存在 | SPEC.md / README.md / CLAUDE.md / 等 | rename 時要 update |
| 全 skill に SKILL.md | `skills/*/SKILL.md` | 新 skill 追加時に template 用意 |

**CI fail パターン と対処**:

- MD029 (ordered list 番号ずれ) → renumber 1/2/3/4...
- MD031 / MD032 (fence/list 周囲空行) → `.markdownlint.json` 緩和済
- MD037 (`__%` 等 emphasis marker 衝突) → backtick quote へ
- MD040 (fenced code language なし) → `.markdownlint.json` 緩和済
- MD056 (table column 数不一致) → cell 内 `|` を `\|` escape または text 変更
- Forbidden phrase → 引用形式の場合は `rules/native-prompting.md` 参照に置換

## 5. release procedure

```text
[1] 機能実装 (skills/agents/commands 変更)
[2] (optional) dog food 実機検証
[3] CHANGELOG.md に v.X.Y.Z section 追加 (Added / Changed / Verified via dog food / Reference 等)
[4] SPEC.md §11 ロードマップ table に v.X.Y を追加 (Status: ✅ released)
[5] **plugin manifest version 同期** (v2.1+ marketplace 経由 install で surface される):
    - .claude-plugin/plugin.json の "version" を vX.Y.Z に
    - .claude-plugin/marketplace.json の plugins[0].version を vX.Y.Z に
[6] pre-commit check:
    - grep -rEinH "step.by.step|double.check|..." agents/ skills/ commands/
    - node -e "JSON.parse(...)" で JSON file 全部
[7] git add . && git commit -m "feat(v.X.Y): ..." (HEREDOC body + Co-Authored-By)
[8] git push
[9] git tag -a vX.Y.0 -m "vX.Y.0 — ..." && git push origin vX.Y.0
[10] gh release create vX.Y.0 --title ... --notes ...
[11] CI watch (sleep 8 + until conc=$(gh run view ...))
[12] CI fail → patch commit → push (CI 自動 retry)
```

**branch protection 経由**: admin (= `myksyut`) は `enforce_admins=false` で直 push 可能。 出力に `Bypassed rule violations` と出るが正常。

## 6. 暗黙の前提 (公式 doc とのずれ含む)

| 領域 | 公式 doc | 実装 (1.59.1 / v1.6 dog food で確認) |
|---|---|---|
| Playwright agents 出力先 | `.github/` | **`.claude/agents/playwright-test-*.md`** |
| Playwright MCP | (一般 `playwright`) | **`playwright-test`** (test 生成専用、 `init-agents` で `.mcp.json` 自動生成) |
| Linear MCP tools | direct 利用 | **ToolSearch で deferred load 必要** (`mcp__plugin_linear_linear__*`) |
| `state` parameter (Linear) | ID? name? 曖昧 | **name 文字列でOK** (e.g., `"Done"`) |
| `save_comment` (Linear) | (制約なし記載) | **issueId 必須、 project 直接コメント不可** → `linear-project-workflow` Update(C) で 4 段階代替パス |
| init-agents で生成される path | `.github/` (古い doc) | **`.claude/agents/` + `.mcp.json` + `specs/`** |
| dog food subprocess の Linear MCP | 「subprocess の Claude が Linear MCP を使う」 (§7.3 当時の想定) | **subprocess は親の Linear MCP 認証を継承しない**。 `--plugin-dir` は pev-harness を読むが Linear MCP は別 plugin。 dog food で Linear write path (Gate L issue 作成 / outbound sync) を verify するには `--mcp-config <linear-mcp-config>` で明示渡しが必要 (harness-effect-v16 / F_v16_1 で判明) |
| codex executor の `--model` | 任意の OpenAI model を指定可と想定 | **ChatGPT subscription 認証では codex-family model のみ利用可**、 `--model o4-mini` 等の汎用 model は HTTP 400 reject (v3.5.0 dog food F_v35_1)。 `pev-external-executor` は `--model` を付けず codex default に委ねる、 pin したい場合のみ `PEV_CODEX_MODEL` env var |

## 7. tools の使い分け (このセッションで確立)

### 7.1 TaskCreate / TaskUpdate

- 3 task 未満の chain なら使わない (overhead)
- 5+ step の大型 release なら最初に全 task を TaskCreate
- 各 task を順次 `in_progress` → `completed`
- stale task は適切に cleanup (system reminder で促される)

### 7.2 Background subprocess (`run_in_background=true`)

- dog food 実行、 CI watch、 npm install (heavy) で活用
- 通知 (`task-notification`) が来てから `cat /tmp/.../output` で結果確認
- sleep + poll はしない (cache miss + token 無駄)

### 7.3 Linear MCP (deferred tools)

- 各 session 最初に `ToolSearch` で必要 tools を load (`mcp__plugin_linear_linear__list_teams` / `save_issue` / etc.)
- 一度 load した tool はそのまま再利用可能

### 7.4 Playwright MCP

- pev-harness の dog food では **subprocess の Claude が** Playwright MCP を使う (私のセッションは直接 invoke 不要)
- 私のセッションで playwright test を直接 invoke したい場合は `npx playwright test` を Bash 経由 (CLI)

### 7.5 音声通知 (mcp__voicevox__speak)

- ユーザー個人の global CLAUDE.md 指示。 各 task 完了 / 重要 milestone / 受領時に短く (100字以内)
- speaker=1, speedScale=1.3 固定

## 8. 失敗パターンと対処

### 8.1 GitHub API timeout / 5xx

- `gh issue create` で 504 → retry (label 既存なら label option 飛ばしてから retry)
- `git push origin <tag>` で 500 → tag push のみ retry
- bg subprocess の途中 fail も同じ retry pattern

### 8.2 system-reminder で「task tools haven't been used recently」

- stale task のクリーンアップを意図的に行う (completed / deleted 化)
- 新 task 追加するか、 既存 task の status を update する
- 何もすることがなければ無視 OK

### 8.3 dog food で sample-project state がずれた

- 私が cp で /tmp/pev-test に避難させて dog food する pattern
- もしくは sample-project 内で dog food → 後で git checkout

### 8.4 forbidden phrase で CI fail

- agents/skills/commands 配下に「禁止フレーズの説明」自体が grep に hit するケースあり
- v0.1 release で発覚済、 rules/native-prompting.md 参照に置換すれば clean

## 9. このリポジトリで「やらないこと」

- 言語別 patterns (python-patterns 等) の bundle
- 自動 fmt / lint helper
- 50+ agents の追加 (ミニマル原則違反)
- 後方互換性 (Claude Code v2.1.154+ 必須 = Opus 4.8 pin のため、 4.6 互換しない)
- カスタム Node.js ヘルパー (plugin 単独で完結)

## 10. 開発者の心構え (これまでのセッションで確立)

1. **設計判断ポイントごとに user 確認**: AskUserQuestion で 2-4 axes を提示、 推奨 + 代替案を必ず付ける
2. **完璧主義より MVP + 反復**: v0.1 で「実装は spec のみ、 dog food で詰める」 が許容
3. **「全部まかせる」モードの時の振る舞い**: 大きな判断点 (visibility flip / Linear write / destructive ops) は user 確認、 細部は自律で進める
4. **暗黙のscope 拡張を避ける**: 1 release = 1 集中 feature、 「ついでにこれもやる」は別 release へ
5. **CI 通すまでが release**: tag push 後すぐ watch、 fail → patch commit、 すべて green になるまで

## 11. Cross-references

- 仕様: [SPEC.md](./SPEC.md) (12章 + ADR 5 件)
- 履歴: [CHANGELOG.md](./CHANGELOG.md) (Keep a Changelog format)
- 公開向け: [README.md](./README.md)
- 社内展開: [ONBOARDING.md](./ONBOARDING.md) + [guide/ROLLOUT-CHECKLIST.md](./guide/ROLLOUT-CHECKLIST.md) + [guide/FEEDBACK-TEMPLATE.md](./guide/FEEDBACK-TEMPLATE.md)
- 脆弱性: [SECURITY.md](./SECURITY.md)
- 規約: [rules/pev-conventions.md](./rules/pev-conventions.md) (Gate respect 等) + [rules/native-prompting.md](./rules/native-prompting.md) (禁止フレーズ) + [rules/error-patterns.md](./rules/error-patterns.md) (エラー推測 catalog)
- **v3.0 設計**: [experiments/v3.0-design.md](./experiments/v3.0-design.md) + [experiments/RFC-v3.0.md](./experiments/RFC-v3.0.md)
- **v3.0 dog food 根拠**: [experiments/harness-effect-v1 to v5](./experiments/) (= 5 件の比較実験、 各 reports/SUMMARY.md に詳細)
- 旧 dog food レポート (v1.x 当時): [guide/dogfood-v1.3-report.md](./guide/dogfood-v1.3-report.md) / [guide/TEST-PLAN-linear-v1.3.md](./guide/TEST-PLAN-linear-v1.3.md)
- 開発 checklist: [guide/CHECKLIST.md](./guide/CHECKLIST.md)
- Issue 一覧: <https://github.com/myksyut/pev-harness/issues>

---

> このファイルは v1.7 で書き換えられた (元は plugin user 向けだったが、 dog food 駆動の開発が確立した v1.6 までを振り返って **開発者向け暗黙知集** として再定義)。 v3.0.2 で v3.0 / v3.0.1 の構造変更 (Triage 新設、 Plan on-demand、 質問判定強化、 F1 scope 限定、 sample-project の form fixture 化) を反映済。
