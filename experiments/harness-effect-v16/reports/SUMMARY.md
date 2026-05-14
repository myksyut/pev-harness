# 実験結果 — harness-effect-v16 (v3.3.1 Gate L 再 dog food)

**実施日**: 2026-05-15
**pev-harness version**: v3.3.1 (= Gate L 配置修正後)
**target**: v15 で検出した F_v15_1 (Gate L dead path) の修正が functional か再検証
**setup**: v15 と同一 (sample-project cp + git init + .linear-config.yml、 ただし `--force-auto` で Execute まで通す)

## TL;DR

| 観点 | v15 (v3.3.0) | **v16 (v3.3.1)** |
|---|---|---|
| Gate L 到達 | ✗ dead path (Gate A の exit で到達せず) | **✓ 到達** (`artifacts/linear/sync_state.json` 生成) |
| Gate L 挙動 | (到達せず) | **degraded mode** (= Linear MCP 未認証 → best-effort skip) |
| pipeline 完走 | Gate A で停止 | **Execute + Verify まで完走** (AC 9/9 PASS、 29/29 test pass) |
| 実 Linear write | (発生せず) | **発生せず** (= F_v16_1、 環境問題) |

**v3.3.1 配置修正は functional**。 Gate L が Gate A の前 (Step 2.5) に移動したことで、 `--force-auto` で pipeline が完走する経路で Gate L に正しく到達。 degraded mode fallback も設計通り。

## Gate L の挙動 (v3.3.1)

agent の最終 response より:

```text
| Gate L (Linear issue-first) | degraded mode — Linear MCP 未認証のため issue 作成スキップ、 main ブランチで実装 |
```

つまり:

1. **Gate L に到達した** (= v3.3.1 配置修正の効果、 v3.3.0 では dead path だった)
2. `.linear-config.yml` を検出して issue-first を起動しようとした
3. Linear MCP plugin が **未認証** だったため degraded mode に fallback
4. warning を出して branch checkout を skip、 **pipeline は止めずに Execute へ進行**
5. `artifacts/linear/sync_state.json` は生成された (= Gate L が実行された証跡)

これは v3.3.0 の Gate L 規約「Linear MCP plugin が unavailable / 認証失敗 の場合は warning を出して branch checkout を skip (= issue-first を best-effort、 pipeline は止めない)」 と **完全に一致した挙動**。 配置修正 + degraded mode の両方が設計通り functional。

## F_v16_1 (priority M): dog food subprocess に Linear MCP 認証が継承されない

期待: subprocess の claude が Linear MCP を使って実 Linear (emuni-kyoto/TES) に issue 作成

実際: subprocess は Linear MCP plugin を **持っていない / 認証されていない**。 agent は「`mcp__plugin_linear_linear__authenticate` で認証してから再実行してください」 と案内。

CLAUDE.md §7.4 には:

> 「pev-harness の dog food では **subprocess の Claude が** Playwright MCP を使う (私のセッションは直接 invoke 不要)」

と書かれており、 §7.3 では Linear MCP も同様に「各 session 最初に ToolSearch で必要 tools を load」 とある。 だが実際には:

- 親 session (= 私) は Linear MCP が deferred で available (= ToolSearch で load 可能)
- subprocess (= `claude --plugin-dir ~/oss/pev-harness -p ...`) は **`--plugin-dir` で pev-harness は読むが、 Linear MCP plugin は別 plugin なので継承されない**

CLAUDE.md の暗黙の前提が部分的に誤っていた。 dog food で Linear write path を verify するには:

- subprocess に `--mcp-config <linear-mcp-config-json>` で Linear MCP server を明示的に渡す
- もしくは `--strict-mcp-config` なしで親の MCP 設定が継承される条件を確認

**反映候補 (CLAUDE.md §6 or §7 の更新)**:

- §6「暗黙の前提」 table に「dog food subprocess は Linear MCP を継承しない、 `--mcp-config` で明示渡しが必要」 を追加
- §3.3 dog food 手順に Linear path を verify する場合の `--mcp-config` 例を追加

## 検証結果まとめ

| 項目 | status |
|---|---|
| v3.3.1 Gate L 配置修正 (= Gate A の前に移動) | ✓ functional |
| Gate L の degraded mode fallback (Linear MCP unavailable 時) | ✓ 設計通り |
| pipeline が degraded mode でも止まらず完走 | ✓ best-effort 設計通り |
| 実 Linear への issue 作成 + branch checkout | ✗ 未検証 (F_v16_1、 subprocess の Linear MCP 認証が別途必要) |

## 実装結果 (= Gate L とは独立に Execute は完走)

`--force-auto` で Execute まで通った結果:

- `src/validation.js`: `validatePhone` に `+` プレフィックス早期分岐を追加 (= E.164 準拠 8-15 桁検証、 国内番号ロジック温存)
- `tests/validation.test.js`: 国際番号 test 9 件追加 (既存 20 件無改変)
- Verify: AC 9/9 PASS、 29/29 test pass、 retry 0

これは v3.0.4 F_v8_2 (= Triage が国際形式の仕様未明示で plan_required)、 planner の確認質問 + conservative default、 Execute の完走 という v3 系 flow が一貫して動いた sample。

## 結論

**v3.3.1 の F_v15_1 hotfix は functional**。 Gate L が Gate A の前に移動したことで dead path 問題が解消、 degraded mode の best-effort fallback も設計通り動作。

実 Linear への書き込み verify は **F_v16_1 (subprocess に Linear MCP 認証が継承されない)** で未達。 これは pev-harness の bug ではなく dog food 環境セットアップの問題。 CLAUDE.md の暗黙の前提を修正 + `--mcp-config` での明示渡し手順を追加すれば verify 可能。

## 次の候補

- **F_v16_1 patch**: CLAUDE.md §6/§7 に「dog food subprocess の Linear MCP は `--mcp-config` で明示渡し」 を追記 (= docs patch、 v3.3.2 候補)
- v17: `--mcp-config` で Linear MCP を渡して実 Linear write path を verify (= 環境セットアップが要る、 別途)
