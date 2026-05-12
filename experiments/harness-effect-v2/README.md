# harness-effect-v2 — 曖昧な指示への対応性能 比較

中程度に曖昧な依頼 (`prompt.txt`) を 2 つの claude session (ハーネスなし / ハーネスあり) に投げ、 **clarification 行動の有無 / 推測品質 / 成果物完成度 / 効率** を比較する。

v1 (明確な spec) と対をなす実験。

## 設計

- **初期 prompt**: 「TODO アプリを作ってください。 ブラウザで使えるシンプルなのが欲しいです。」 — ドメインは明確、 制約 / 機能詳細は未指定 (= 中程度に曖昧)
- **仮想ユーザー**: orchestrator (= 親 claude session) が [virtual-user.md](virtual-user.md) の想定要件セットを参照し、 agent から質問された項目だけに 1-2 文で返答。 未掲載項目は「お任せします」
- **進行**: 順次 (no-harness 完走 → with-harness 完走)
- **wrap**: 両者同じ初期 prompt、 ハーネスあり側のみ `/pev-harness:pev <prompt>` で wrap (`--force-auto` は使わない、 質問返しを期待するため)

## 構成

```text
experiments/harness-effect-v2/
├── README.md            # 本 file
├── virtual-user.md      # 仮想ユーザーの想定要件セット + 応答ルール
├── prompt.txt           # 初期 prompt (両者共通)
├── EVALUATION.md        # 採点 rubric (4 軸 × 10 点)
├── logs/                # 各 session の対話 log (turn-by-turn)
│   ├── no-harness/      # no-harness session の全 turn (prompt / response 分離 markdown)
│   └── with-harness/    # 同上
├── scratch/             # claude が生成したファイル (rm-able、 .gitignore は scratch/*/node_modules/ のみ)
│   ├── no-harness/
│   └── with-harness/
└── reports/             # SUMMARY.md / metrics.json
```

## orchestrator (= 親 claude session) の遵守事項

`virtual-user.md §「応答ルール」` を厳守:

1. 聞かれた項目だけ答える、 関連項目を勝手に開示しない
2. 答えは 1-2 文の短いもの
3. 想定要件セットに該当しない項目は「特にこだわりなし、 お任せします」
4. agent が完成宣言したら「ありがとう、 確認します」 で終了
5. virtual-user.md の更新は禁止 (= 走らせる途中で「思いつき」を追加しない)

## 進行手順

### Phase 0. setup

```bash
cd experiments/harness-effect-v2
mkdir -p scratch/{no-harness,with-harness} logs/{no-harness,with-harness}
# prompt と virtual-user は既に置いてある
```

### Phase 1. no-harness 走行

```bash
cd scratch/no-harness
# turn 1 (initial)
claude --print --permission-mode bypassPermissions \
       --output-format stream-json --verbose \
       --include-partial-messages --model claude-opus-4-7 \
       "$(cat ../../prompt.txt)" \
       > ../../logs/no-harness/turn1.stream.jsonl
# orchestrator が response を読み、 質問返しかどうか判定
# 質問返しなら virtual-user.md から該当回答を抽出
# 続行:
claude --continue --print --permission-mode bypassPermissions \
       --output-format stream-json --verbose \
       --include-partial-messages --model claude-opus-4-7 \
       "<orchestrator-reply>" \
       > ../../logs/no-harness/turn2.stream.jsonl
# 完成宣言まで繰り返し、 最後に orchestrator が「ありがとう、 確認します」 で終了
```

### Phase 2. with-harness 走行

```bash
cd scratch/with-harness
# turn 1: /pev-harness:pev で wrap、 --force-auto なし (質問返し期待)
claude --plugin-dir ~/pev-harness --print --permission-mode bypassPermissions \
       --output-format stream-json --verbose \
       --include-partial-messages --model claude-opus-4-7 \
       "/pev-harness:pev $(cat ../../prompt.txt)" \
       > ../../logs/with-harness/turn1.stream.jsonl
# 以下同様、 質問返し → 応答 → 続行 のループ
```

### Phase 3. 集計 & 評価

- `logs/{no,with}-harness/turn*.stream.jsonl` から turn 数 / token / 質問返し回数 / 推測項目数 を抽出
- `scratch/{no,with}-harness/` の成果物を `virtual-user.md` 想定要件セットと突き合わせて completion 率を算出
- `EVALUATION.md` の rubric で採点
- `reports/SUMMARY.md` に結果を起草

## 期待される観察ポイント

- ハーネスあり: planner agent が **Goal/Constraints/AC** を要求する性質、 中程度曖昧では質問返し発生確率高
- ハーネスなし: 平均的 TODO アプリの common pattern (localStorage + vanilla JS) を推測する性質
- token / 時間: 質問返しが繰り返されると turn 数増、 ただし手戻り少ない可能性
- 完成度: 仮想ユーザーの非開示要件 (Q10 完了タスク別 section / Q5 編集不要 等) を agent が推測で踏めるか否か

## 注意

- orchestrator (= 親 claude) が virtual-user.md を確認できる位置にいる必要 (このリポジトリ内)
- 実行中 orchestrator は「自分の判断で追加要望を出さない」 規律を持つ。 これは regression 防止のため、 各 turn の orchestrator-reply を logs/ に保存して後追い検証可能にする
- 一度走らせた session を再現したい場合は logs/{no,with}-harness/turn*.stream.jsonl と orchestrator-reply 全部 と prompt.txt + virtual-user.md があれば再現可能
