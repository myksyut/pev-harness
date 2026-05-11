# Sample Project for pev-harness

最小サンプル。pev-harness を dog food するための「壊れていい」プロジェクト。

## 構造

```
sample-project/
├── README.md           (このファイル)
├── package.json        (最小Node.js設定)
├── src/
│   └── index.js        (TODOを含む簡単な関数)
├── tests/
│   └── index.test.js   (vitest)
└── team-conventions.md (sample-project用の規約)
```

## How to dog food

```bash
cd ~/pev-harness/examples/sample-project

# 依存インストール (一度だけ)
npm install

# pev-harness をsession単位で読み込み
claude --plugin-dir ~/pev-harness

# Claude Code セッション内で:
> /pev-harness:pev "Implement the TODO in src/index.js — make add(a, b) return a + b. Add a test case."
```

期待される挙動:

1. planner が `artifacts/plan.md` を生成
2. permissionMode=default なので Gate A で停止 (plan.md表示)
3. ユーザーが内容を確認して `/pev-harness:pev-execute` で続行
4. executor が src/index.js と tests/index.test.js を変更
5. Stop hookが verifier 起動を促す
6. `/pev-harness:pev-verify` で検証 (`npm test` 実行)
7. verify.json が PASS なら完了

## クリーンアップ

```bash
rm -rf artifacts/
git checkout -- src/index.js tests/index.test.js
```
