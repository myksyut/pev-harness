# Dog Food Evidence

v0.1.1 で実施した自動 dog food の成果物。

## 実行内容

```bash
cd ~/pev-harness/examples/sample-project
npm install                      # vitest を入れる
claude --plugin-dir ~/pev-harness --print \
  '/pev-harness:pev "Implement add(a, b) in src/index.js to return a + b. Acceptance criteria: existing tests in tests/index.test.js must pass."'
```

## 結果

- ✅ **plan.md** (1658 bytes): planner agent が高品質な計画を生成
  - team-conventions.md を参照
  - Estimated task budget: ~2k tokens (pev-task-budget skill 機能確認)
  - 独自で Non-goals セクションを追加 (planner judgement)
- ✅ **execute.log**: executor が src/index.js を `return a + b;` に正しく書き換え
- ✅ **vitest 2/2 PASS**: Acceptance Criteria 完全達成

## 確認できなかった項目 (v0.2 以降の対応)

- ⚠️ **verify.json 自動生成**: Stop hook が headless 環境で発火しなかった
- ⚠️ **recap.log 書き込み**: pev-recap skill の自動起動が効いていない (Issue #4)
- ⚠️ **subagent memory**: ~/.claude/pev/{task_id}/ への書き込みが行われていない (Issue #2)

## 含まれるファイル

- `plan.md` — Phase 1 の生成物 (実物)
- `execute.log` — Phase 2 の生成物 (実物)
- `README.md` — このファイル

これらは「v0.1 がどこまで動くか」のエビデンスとしてコミット。次の dog food では `examples/sample-project/artifacts/` に新しい成果物が出る (gitignore対象)。
