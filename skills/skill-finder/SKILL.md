---
name: skill-finder
description: 外部ソースから skill を発見・評価して pev-harness に取り込むかを判断するメタスキル。"find a skill for X" / "is there a skill for X?" / "evaluate this candidate before adopting" のような明示的な要求にのみ起動。pev-harness core skills (SPEC.md §7) で既にカバーされる場合は即座に停止して core skill を使うよう案内する。
---

# Skill Finder

外部 skill を pev-harness に取り込む判断は、内蔵 skill を使う場合とは違う2つの failure mode を持つ:

1. **品質バラつき** — registry の vetting レベルがまちまち。SEO scrape のものもある
2. **Tier-1 盲点** — 公式ソースで既に同じニーズがカバーされているのに、いきなり GitHub `grep` から始めて noise に当たる

このスキルの存在意義は、「外部ソース横断調査を慎重に行う」「dog food 経由の試走を経ずに採用しない」の2つを規律として強制すること。

## When to Use

明示的なユーザー要求のみ起動。

トリガーフレーズ:

- "find a `<X>` skill"
- "is there a skill for `<X>`?"
- "evaluate `<owner/repo>` as a skill before adopting"
- "search registries for `<X>`"

When NOT to use:

- pev-harness の core skill (SPEC.md §7) で既にカバーされる → **即停止** して core skill を案内
- 一回限りのタスク → skill 化せずインラインで解決
- ユーザーが discovery を要求していない → メタスキルなので自動起動しない

## Pre-flight check (必須)

何より先に SPEC.md §7 の Skills 一覧を確認する。マッチする core skill があれば:

1. ユーザーに「core skill の `<name>` が該当します」と伝える
2. それを使うよう案内
3. **停止**。Tier 1+ の調査に進まない

特に `pev-pipeline` / `pev-spec-template` / `pev-task-budget` / `pev-recap` あたりはよく overlap する。

## Sources

優先度順。上から始めて、上で fit が見つからない時のみ下へ。

| Tier | Source | 信頼度 | Notes |
|---|---|---|---|
| 1 | `anthropics/skills` (GitHub) | ★★★ | 公式skills、Anthropic直 |
| 1 | `anthropics/claude-plugins-official` | ★★★ | Claude Code 公式marketplace |
| 2 | `majiayu000/claude-skill-registry` | ★★ | daily-crawled & dedup'd 横断index |
| 2 | `VoltAgent/awesome-agent-skills` | ★★ | org-grouped awesome-list (MIT, active) |
| 3 | `ComposioHQ/awesome-claude-skills` | ★ | broader curation、候補扱い |
| 3 | `obra/superpowers` | ★★ | methodology-heavy bundle (TDD/subagent等) |
| 4 | GitHub `topic:claude-skill` / `path:**/SKILL.md` search | ☆ | last resort、recent-update 順で sort |
| NG | `agent-skills.cc` | ✗ | SEO scrape、stars-only signal、参考にしない |

## Workflow

1. **Pre-flight catalog check** (上記、必須)
2. **再発タスクを言語化** — skill 化は recurring task type でしか正当化されない
3. **Top-down sweep** — Tier 1 → 2 → 3 → 4。fit が見つかったら下位を survey しない
4. **Rubric 適用** (7 axes、全部 acceptable で合格):
   - **Fit**: skill の "Use when..." がプロジェクトのタスクに本当に合うか
   - **Non-redundancy**: pev-harness 既存 skill と被らないか (被るならreject)
   - **Maintenance**: last commit 直近、active か
   - **License**: SPDX present、互換性
   - **Frontmatter health**: `name` がディレクトリ名と一致、description ≤1024字、triggering-condition shaped
   - **Body quality**: "When NOT to use" あり、抽象論ではなく具体的パターンか
   - **Footprint**: body length、demand-loaded か always-loaded か、依存数
5. **Dog food gate** (必須) — 評価なしの採用はこのスキルが防ぐ唯一の failure mode:
   - 一時install: ユーザーproject の `.claude/plugins/` に手動配置 or `--plugin-dir` で session単位
   - PEV pipeline で 1〜2 representative task を走らせる
   - PASS/FAIL を `examples/verify.example.json` 風に記録
   - FAIL の原因が skill 由来なら **reject**
6. **Decide and pin**:
   - **Adopt and add to SPEC.md §7** — dog food PASS で 2+ project で使われている
   - **Project-pin** — 1 project にのみ fit。プロジェクトの `.claude/settings.json` に install
   - **Reject** — `~/.claude/pev/skills-rejected.md` に理由を記録 (3ヶ月後に同じ候補で再評価する churn を防ぐ)
7. **Fork-and-fix** — close-but-not-quite なら fork して `<your-org>/skills/<name>` で reshape する方が呼び出し側 workaround より良い

## Source-specific resolution notes

- **`anthropics/skills`**: skills は `skills/<name>/` 直下。`.claude-plugin/plugin.json` のmanifest を確認
- **`anthropics/claude-plugins-official`**: marketplace 経由 install。`/plugin install <name>@claude-plugins-official` 形式
- **`majiayu000/claude-skill-registry`**: 独自CLIあるが不要。registry の web UI / data file を discovery にだけ使う
- **`VoltAgent/awesome-agent-skills`**: README から URL抽出:

```bash
curl -sL https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md \
  | grep -oE '\[[^]]+\]\(https?://[^)]*github\.com[^)]+\)'
```

- **GitHub topic search**: `topic:claude-skill` (1.4k repos) と `topic:agent-skills` (4.3k) は noisy。`path:SKILL.md` qualifier で narrow。star count は Tier 3 以下では signal になりにくい (高star は awesome-list が多い)

## Common mistakes

| Mistake | Fix |
|---|---|
| 全 Tier を並列 survey | Top-down、最初の fit で停止 |
| Pre-flight catalog check スキップ | SPEC.md §7 必ず先 |
| "Fit ✓" だけで採用 | Non-redundancy も独立 axis |
| Reject時に理由を記録しない | `skills-rejected.md` に書く (再評価防止) |
| `agent-skills.cc` を recommendation source にする | alias-lookup のみ、primary source 不可 |
| Dog food せず採用 | 禁止。このスキルが防ぐ唯一の failure |
| `main` / `master` への pin | 評価で通ったtag/SHA に pin する |
| Tier 4 へ Tier 1-3 sweep なしで飛ぶ | Tier 1-3 は pre-filtered、cost asymmetry 大 |

## Related

- **SPEC.md §7** — pev-harness core skills 一覧 (pre-flight check の対象)
- **pev-spec-template** — 採用候補の dog food 用 task spec を整形
- **pev-pipeline** — 候補skill を 1 task で実走させる pipeline
- 当初の inspiration: mizchi の skill-finder (apm/waxa-eval ベース) を pev-harness 文脈にporting

## なぜ pev-harness に必要か

pev-harness 自体は agent 3 / skill 8 (このskillで 9) のミニマル設計。だが、ユーザープロジェクトが追加 skill を求めることは確実にある。その時の判断 framework がないと:

- 雑な選定で skill 増殖 (このプラグインの設計思想と矛盾)
- 同じ候補を繰り返し評価 (時間の無駄)
- dog food せず採用 (untested code のような状態)

このメタスキルが「採用 churn」を予防する。
