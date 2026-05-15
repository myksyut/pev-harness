# 実験結果 — harness-effect-v17 (実 Linear write path 検証)

**実施日**: 2026-05-15
**pev-harness version**: v3.3.2
**target**: Gate L (Linear issue-first) の **実 Linear への issue 作成 + branch checkout** を検証
**前提**: Linear MCP を `/plugin` で再認証済 (= 親 session は Linear MCP available)

## TL;DR

| 検証項目 | 結果 |
|---|---|
| headless subprocess での実 Linear write | ✗ **構造的に不可** (F_v17_1) |
| 親 session による Direction 1.5 ground-truth 検証 | **✓ 全ステップ verify** |
| `save_issue` で issue 作成 (team 名 → teamId 解決) | ✓ TES-1 作成、 status "In Progress" |
| branch 名の取得 | ✓ `gitBranchName` field が **save_issue 戻り値に含まれる** (F_v17_3) |
| `git checkout -b <branchName>` (日本語含む) | ✓ 動作 |
| artifacts/linear/ 4 ファイル生成 | ✓ issue_id / issue_url / branch_name / sync_state.json |
| outbound success の status 遷移 (Done) | ✓ TES-1 → Done 簡易 verify |

## F_v17_1 (priority H): headless subprocess は hosted MCP の OAuth を完了できない

v17 で subprocess に `--mcp-config '{"mcpServers":{"linear":{"type":"http","url":"https://mcp.linear.app/mcp"}}}'` を渡したが、 subprocess は Gate L で **OAuth 認証 URL を出して停止**:

```text
Gate L で Linear issue を作成するため、 Linear MCP サーバーの認証が必要です。
以下の URL をブラウザで開いて認証してください:
https://mcp.linear.app/authorize?response_type=code&client_id=...
```

`--mcp-config` で server config は渡せるが、 **OAuth token は parent process と共有されない**。 hosted MCP の OAuth は per-process、 かつ `-p` (--print) headless mode はブラウザ OAuth フローを完了できない。

**結論**: **headless dog food subprocess では実 Linear write path は構造的に検証不能**。 これは pev-harness の bug ではなく、 Claude Code の MCP OAuth アーキテクチャの制約。

**対処**: 実 Linear write の検証は (a) interactive session で `/pev` を直接打つ、 もしくは (b) 親 session が Linear MCP を持つ状態で Direction 1.5 のロジックを ground-truth 検証する。 v17 は (b) を採用。

## F_v17_2 (priority M): Gate L が「config あり・未認証」 で degraded せず OAuth block する

v16 と v17 で Gate L の挙動が異なった:

| run | Linear MCP の状態 | Gate L の挙動 |
|---|---|---|
| v16 | plugin が subprocess に無い (= 完全 unavailable) | **degraded mode** (warning + skip、 pipeline 続行) |
| v17 | `--mcp-config` で config あり、 だが未認証 | **OAuth URL を出して block** (pipeline 停止) |

v3.3.0 の Gate L 規約は「Linear MCP plugin が unavailable / 認証失敗 の場合は warning を出して branch checkout を skip (= best-effort、 pipeline は止めない)」。 だが「configured but unauthed」 のケースで agent が OAuth を試みて block する = **spec の degraded mode が発動しない gap**。

**反映候補 (v3.3.3)**:

- commands/pev.md Gate L に「**headless (`-p`) mode で Linear MCP が未認証の場合は OAuth を試みず degraded mode に倒す**」 を明記
- pev-linear-sync SKILL.md の degraded mode 条件に「configured but unauthed」 を追加

## F_v17_3 (priority L、 skill 精度): branch 名の field は `gitBranchName`

pev-linear-sync SKILL.md Direction 1.5 は branch 名取得を:

> 「`save_issue` の戻り値、 もしくは `get_issue` で issue を再取得 ... `branchName` field (field 名が MCP server version で異なる場合あり (`branchName` / `gitBranchName` / `git_branch_name`))」

と曖昧に書いていた。 実機検証で確定:

- **実際の field 名は `gitBranchName`**
- **`save_issue` の戻り値に既に含まれる** (= `get_issue` での再取得は不要)
- 例: `"gitBranchName":"shotamiyaki/tes-1-pev-dog-food-v17-電話番号-validator-の国際電話番号形式対応"`

→ SKILL.md を「`save_issue` 戻り値の `gitBranchName` field を使う、 万一不在なら `get_issue` で再取得」 に pin。

## Direction 1.5 ground-truth 検証 (= 親 session 実施)

subprocess の plan.md を issue body にして、 私 (親 session、 Linear MCP 認証済) が Direction 1.5 のステップを手動で walk through:

1. **`.linear-config.yml` 読み込み**: workspace=emuni-kyoto, team.id=TES, team.name=test
2. **issue body 組み立て**: subprocess が生成した `artifacts/plan.md` の Goal / Constraints / AC を転記
3. **`save_issue` で新規 issue 作成**:
   - team="test" → teamId `48a4ad28-...` に解決
   - state="In Progress" → statusType "started" に解決
   - 結果: **TES-1** 作成、 url `https://linear.app/emuni-kyoto/issue/TES-1/...`
4. **branch 名取得**: save_issue 戻り値の `gitBranchName` = `shotamiyaki/tes-1-pev-dog-food-v17-電話番号-validator-の国際電話番号形式対応`
5. **`git checkout -b <branchName>`**: 日本語含む branch 名でも正常に checkout (= `Switched to a new branch ...`)
6. **artifacts/linear/ 生成**: issue_id.txt / issue_url.txt / branch_name.txt / sync_state.json の 4 ファイル
7. **outbound success 簡易 verify**: `save_issue id=TES-1 state=Done` → status "Done" / completedAt set

**Direction 1.5 の全ステップが実機で動作確認できた**。 skill のロジックは sound。 唯一の課題は headless subprocess で OAuth が完了できないこと (F_v17_1)、 これは pev-harness の外の制約。

## cleanup

- TES-1 は Done 遷移済 (= v17 の dog food test data として残す、 CLAUDE.md §3.2 の累積 test data 方針)

## 結論

v3.3 系の Linear issue-first workflow は **ロジックとしては完全に sound** (= Direction 1.5 の全ステップが ground-truth verify 済)。 ただし:

1. **F_v17_1**: headless dog food subprocess では実 Linear write は OAuth 制約で検証不能 — interactive session か親 session 経由でしか verify できない
2. **F_v17_2**: Gate L が「config あり・未認証」 で degraded せず block する — v3.3.3 で degraded 条件を refine
3. **F_v17_3**: branch field は `gitBranchName` (save_issue 戻り値に含まれる) — v3.3.3 で SKILL.md を pin

v3.3.3 で F_v17_2 + F_v17_3 を patch すれば v3.3 系の Linear workflow は実用レベルで完成。
