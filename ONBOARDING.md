# Onboarding pev-harness

社内チーム展開向けの導入ガイド。

## 1. インストール (個人ごと)

```bash
# Claude Code v2.1.111+ を確認
claude --version

# plugin としてclone
cd ~/.claude/plugins
git clone <repo-url> pev-harness

# プラグインが認識されているか
claude /plugins list | grep pev-harness
```

## 2. プロジェクトへの導入

```bash
cd <your-project>

# (任意) team-conventions.md を作成
cat > team-conventions.md << 'EOF'
# Team Conventions

- TypeScript strict mode必須
- テストは vitest
- コミットメッセージは conventional commits
- PRレビュー前に必ず /pev-verify を通す
EOF
```

`team-conventions.md` があれば、planner/executor 起動時に自動的にpromptに注入される。

## 3. 最初のタスク

```
/pev "Add a /healthz endpoint at src/server.ts that returns {status: 'ok'}.
Constraints: no new dependencies. 
Acceptance: GET /healthz returns 200 + correct JSON, test added."
```

以下の流れで進む:

1. **Phase 1 (Plan)**: planner が `artifacts/plan.md` を出力
2. **Gate A**: permissionMode が `default` なら停止 → 内容確認 → `/pev-execute` で続行
3. **Phase 2 (Execute)**: executor が実装
4. **Phase 3 (Verify)**: verifier が build/test/AC checkを実行 → `artifacts/verify.json`
5. PASSなら完了、FAILなら planner にリトライ (最大3回)

## 4. permissionMode の使い分け

| Mode | 用途 | Gate A挙動 |
|---|---|---|
| `default` | 通常作業、レビュー必須タスク | plan.md出力後に停止 |
| `auto` | 信頼できる軽微なタスク (linter修正、typo等) | スキップ、自動でexecute開始 |
| `plan` | 設計レビュー、見積もりのみ | plan.md出力後に終了 (executeしない) |

切替方法:
- セッション内: `Shift+Tab` キー
- 個人デフォルト: `~/.claude/settings.local.json` に `"permissionMode": "auto"`

## 5. `--strict` モード (dual review)

リリース直前など重要タスクで使う:

```
/pev "Refactor auth middleware to use JWT" --strict
```

verify段階で Reviewer A (Opus xhigh) と Reviewer B (Sonnet high) が並列で独立レビュー。両方PASSしないとshipしない。

## 6. トラブルシューティング

| 症状 | 対処 |
|---|---|
| planner が "Goal/Constraints/AC を教えて" と返す | 初回プロンプトに3要素を含める |
| verify が同じ理由で3回FAIL | `/pev-status` で plan.md を確認、計画自体が誤っている可能性 |
| executor が並列起動しない | 独立ファイルか確認、`PEV_PARALLEL_EXECUTOR_MAX=3` 確認 |
| artifacts/ が消えた | `/pev-status` で復旧、`~/.claude/pev/{task_id}/` のmemoryから一部復元可能 |

## 7. 既知の制約

- **dual review は同じモデルファミリー** (Claude only) — 真のmodel diversityはなし。v2.0でMCP経由の外部model対応予定
- **言語別tooling非対応** — プロジェクト側で formatter / linter を用意
- **Windows未検証** — macOS / Linux でのみ動作確認

## 8. チームでの運用ルール (推奨)

- `team-conventions.md` は PR レビュー対象に含める
- `artifacts/` は gitignore (タスク固有のため)
- `/pev --strict` は main へのマージ前必須
- ペアプロ的な小修正は `/pev` を使わず通常モードで
