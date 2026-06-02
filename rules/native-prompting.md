# Native Prompting Rules (4.X-native)

Claude 4.X (Opus 4.7 / 4.8) で逆効果になる「4.6 時代の scaffolding」の禁止リストと、代替方法。 旧称 `rules/4.7-native.md` (v3.6.0 で version 中立名へ改名 — anti-scaffolding の核は 4.X 共通で、 model world view が上がるたびに改名する必要をなくすため)。

## 禁止フレーズ (agent / skill prompt内)

| 禁止 | 理由 | 代替 |
|---|---|---|
| "Let's think step by step" | adaptive thinking が自動で行う | 何も書かない。必要なら effort: xhigh |
| "step-by-step" | 同上 | 同上 |
| "Be thorough" | 4.X は task の複雑さに応じて自動調整 | "Cover all acceptance criteria" (具体的に書く) |
| "Be careful" | 冗長 | 具体的な制約をConstraintsに書く |
| "Double-check" | self-verification 既定で有効 | 何も書かない。検証は verifier の仕事 |
| "Verify your output" | 同上 | 同上 |
| "You are an expert X" | 4.X はopinionated既定 | description だけ書いてpromptには書かない |
| "You are a senior X" | 同上 | 同上 |
| "Think carefully" | 同上 | effort で制御 |
| "Take your time" | 4.X は自然に必要な時間を取る | 何も書かない |
| "Reason through this" | 同上 | 同上 |

## 推奨パターン

### 役割定義の代わりに

❌ Before:
```
You are a senior software architect with 20 years of experience...
```

✅ After (frontmatter):
```yaml
---
name: planner
description: PEV Phase 1 — タスク仕様を読んで実装計画を artifacts/plan.md に書き出す
---
```

Promptには「役割」は書かず、「やること」だけ書く。

### 指示の代わりに contract

❌ Before:
```
Please carefully analyze the codebase and step-by-step write a plan, double-checking your assumptions.
```

✅ After:
```
入力: Goal / Constraints / Acceptance Criteria (必須)
出力: artifacts/plan.md (File-level changes, Verification strategy, Risksを含む)
```

入出力の contract を明示。動作詳細は agent に任せる。

### 検証の代わりに hook

❌ Before:
```
Before returning, verify that your code compiles, passes tests, and meets all criteria.
```

✅ After:
- agent prompt には書かない
- `hooks/hooks.json` の Stop hookで verifier を自動起動
- verifier agent が build/test/AC check を実行

## 効果

- agent prompt の token数削減 (30-40%減)
- 4.X が「指示の literal 解釈」モードのまま動く (4.8 で literal instruction-following は更に強化)
- 出力品質が安定する (scaffolding と本旨の区別がつかなくなる現象を回避)

## 例外

以下のフレーズは**禁止しない**:

- "If X, do Y" (条件分岐の明示)
- "Output format: ..." (出力仕様)
- "Forbidden: ..." (制約)
- 数値・閾値の明示 ("Max 3 retries")

これらは literal instruction として有用。

### scoped self-verify の扱い (4.8 公式整合, v3.6.0)

「公式 1次情報との関係 — Opus 4.8 での再評価」 節の通り、 公式 Thinking guidance は **targeted な self-verify** (`verify your answer against [test criteria]`) を「coding / math で確実にエラーを捕捉する」 として推奨する。 一方、 本ファイル冒頭の禁止表は **blanket な** "Double-check" / "Be thorough" / "Verify your output" を ban している。 この 2 つの線引きを規約として明文化する:

**判定軸 = 検証対象が明示されているか**:

- ✅ **許可 (scoped)**: 検証対象 (plan.md の AC / test criteria / 具体的な file・関数) を **名指しした** verify 指示。 adaptive thinking が「何と照合すべきか」 を取り違えないための情報提供であり、 scaffolding ではない。
- ❌ **禁止 (blanket)**: 検証対象を持たない無条件の自己検証。 adaptive thinking が既に自動で行うため、 冗長 scaffolding として出力品質を下げる。

❌ Before:
```
Double-check your work and be thorough before returning.
```

✅ After:
```
Verify the diff against each acceptance criterion in plan.md.
```

なお verifier agent の検証は依然 hook 駆動が原則 (本ファイル「検証の代わりに hook」 参照)。 本例外は「agent prompt 内に書いてよい verify 指示の形」 を緩めるものであって、 検証を prompt 自己宣言に戻すものではない。


## 公式 1次情報との関係 (v2.1.2 追記)

Anthropic 公式 [Best practices for Claude Opus 4.7 with Claude Code (B1, 2026-04-16)](https://claude.com/blog/best-practices-for-using-claude-opus-4-7-with-claude-code) は実は **adaptive thinking の制御 hint としての "step-by-step" を許容している**:

> If you want more thinking, try something like, "Think carefully and step-by-step before responding; this problem is harder than it looks."

PEV-harness が `agents/` `skills/` `commands/` 配下で "step-by-step" を CI で全面 ban している運用との関係:

- **PEV-harness の禁止対象**: 「4.6 時代の冗長 scaffolding として無自覚に付けられる "step by step"」 — adaptive thinking が自動でやることを **重複して書く** ケース
- **公式が許容する用法**: 「タスクの難易度が直感より高いことを明示的に伝える thinking hint」 — `effort: xhigh` で代替可能だが、 session 内で動的に強める手段としては有効
- **運用上の結論**: agent / skill / command の **prompt 本文** には書かない (CI 維持)。 ただし adaptive thinking を強める必要があれば `effort` field を上げる、 もしくは ユーザー自身の対話入力で hint を渡す (CI 対象外)

つまり 「PEV-harness 内部の prompt 規約は公式より厳しいが、 公式に違反しているわけではない」。

## 公式 1次情報との関係 — Opus 4.8 での再評価 (v3.6.0 追記)

Opus 4.8 リリース時の公式 prompting guidance ([What's new in Claude Opus 4.8](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-8) / [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)) を調査した結果:

- **anti-scaffolding の核は 4.8 公式が明確に支持**: 「否定形より肯定形 (tell Claude what to do instead of what not to do)」「`CRITICAL: You MUST` 系の過剰強調を弱める」「prescriptive な hand-written step より general instruction を優先」。 よって本ファイルの禁止表は 4.8 でも **維持** (むしろ 4.8 の literal-following 強化で重要度が増す)。
- **ただし scoped self-verify は 4.8 公式が推奨**: Thinking 節は「`Before you finish, verify your answer against [test criteria]`」 という targeted self-check を「coding / math で確実にエラーを捕捉する」 として推奨する。 よって blanket な "double-check / be-thorough" のみ禁止し、 AC / test criteria に対する **targeted な verify 指示は許可** する (下記「例外」 参照)。
- これは v2.1.2 で予告した「v2.2+ で禁止表を緩める案」 の具体化。 CI grep (`verify your output` = output 限定) は scoped verify 形 (`verify against [criteria]`) を元々ヒットしないため **CI は変更不要**。

## vendored Anthropic 公式 skills の扱い (v2.1.3 追記)

`skills/skill-creator/` と `skills/frontend-design/` は [anthropics/skills](https://github.com/anthropics/skills) からの **完全 vendoring** (upstream そのまま同梱)。 公式 wording の中には PEV-harness 規約が禁止する "take your time" "Be thorough" "step-by-step" 等が含まれる箇所がある。

運用方針:

- **vendored 配下は CI 禁止フレーズ check から除外** (`.github/workflows/ci.yml` の `--exclude-dir=skill-creator --exclude-dir=frontend-design`)
- **理由**: 公式 skill は Anthropic が責任を持って維持しており、 pev-harness が改変するのはむしろ vendoring の理念に反する。 upstream patch 時の merge cost も上がる
- **新規に pev-harness 独自の skill を追加する時は本 rule 適用**。 vendoring 例外を勝手に拡張しない

## checklist (新しい agent / skill 追加時)

新規ファイルを書く時、以下を確認:

- [ ] 「You are a ...」で始めていない
- [ ] "step by step" "carefully" "thorough" が含まれない
- [ ] "double-check" "verify your output" が含まれない
- [ ] 入出力 contract が明示されている
- [ ] 検証は hook側で書いていない
