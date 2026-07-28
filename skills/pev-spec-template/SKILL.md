---
name: pev-spec-template
description: タスク開始時の初回プロンプト雛形を提示。Goal/Constraints/Acceptance Criteria の3要素を強制し、Opus 世代 (現行 Opus 5) のliteral instruction-followingに最適化された入力を作る
---

# pev-spec-template

初回プロンプトを「Opus が literal に解釈しても期待通り動く」形に整形するスキル。

## When to Use

- `/pev <task>` の `<task>` 部分が自然文だけの場合 (v3.0+ では Triage が plan_required と判定した後に planner が起動する flow で利用)
- planner が「Goal/Constraints/ACが不足」と返した時
- 新規タスクを開始する前のpre-flight check

## なぜ必要か

Opus 世代は**暗黙の文脈を補完しない**(4.8 → 5 と世代を追うごとに literal instruction-following は強化)。4.6なら「READMEを更新して」だけで動いてくれたが、4.8以降は文字通り「READMEを更新する何か」をする。曖昧な指示は曖昧な結果を生む。

このskillは、自然文タスクを以下の4要素に分解する:

## テンプレート

```markdown
# Task: <一行で>

## Goal
<達成したいこと。動詞で始まる。1〜3文>

## Constraints
- <やってはいけないこと>
- <依存制約>
- <既存の慣習>

## Acceptance Criteria
- [ ] <検証可能な成功条件 1>
- [ ] <検証可能な成功条件 2>
- [ ] <検証可能な成功条件 3>

## Files (任意)
- <既知の関連パス>
- <参考実装>
```

## How It Works

1. ユーザー入力を分析して上記4要素を抽出
2. 不足する要素を質問返し
3. 全部揃ったら planner に渡す

### 抽出ヒューリスティック

| 入力パターン | 抽出例 |
|---|---|
| "Xを追加して" | Goal: Xを追加 |
| "Yを使ってはいけない" | Constraints: Yを使わない |
| "テストが通る必要がある" | AC: テストが通る |
| "リファクタして" | Goal不十分 → 質問返し ("何を、何のために?") |

### 質問返しの定型

不足要素がある場合の聞き方:

```
このタスクを始めるために、以下を教えてください:

- Goal: 達成したいことを動詞で始めて1〜3文で
  例) "src/server.ts に /healthz endpointを追加する"

- Constraints: やってはいけないこと、依存制約 (なければ「特になし」)
  例) "新規依存追加禁止、TypeScript strict 維持"

- Acceptance Criteria: 検証可能な成功条件をチェックリストで
  例)
    - GET /healthz が 200 を返す
    - レスポンスが {status: "ok"} の JSON
    - tests/server.test.ts にテストが追加されている
```

## Examples

### Bad input
```
/pev "ヘルスチェック作って"
```

→ Goal曖昧 / Constraints不明 / AC不明 → 質問返し

### Good input (このskillが整形する前後)

**Before:**
```
/pev "src/server.ts に healthz エンドポイント追加、新規依存禁止、テストも書いて"
```

**After (skillが整形):**
```markdown
# Task: Add /healthz endpoint

## Goal
src/server.ts に GET /healthz endpoint を追加する

## Constraints
- 新規依存追加禁止
- TypeScript strict mode 維持

## Acceptance Criteria
- [ ] GET /healthz が 200 を返す
- [ ] レスポンスが {status: "ok"} の JSON
- [ ] tests/server.test.ts に対応するテストが追加されている

## Files
- src/server.ts (変更対象)
- tests/server.test.ts (テスト追加先)
```

## 注意点

- ACが**検証可能** (`build pass`, `test pass`, `lint clean` 等の具体的) であることを確認
- `Goal` に「Better にする」「Clean up する」のような曖昧表現があれば必ず質問返し
- `team-conventions.md` がある場合、Constraints の補完候補として参照する
