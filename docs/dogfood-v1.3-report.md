# Dog food report — v1.3 Linear integration

**Date**: 2026-05-11
**Duration**: 約 1h16min (active execution ~38min)
**Subject**: `linear-project-workflow` (v1.3 candidate, new) + `pev-linear-sync` (v1.2 existing) の実機検証
**Environment**: Linear workspace `emuni-kyoto`、 test team `TES`、 sample-project `/tmp/pev-test/`

## Executive summary

Phase 1-5 全 sub-phases を実機で完走し、 **28 件の skill spec gap** を identify。 v1.3.0 release で High priority 4 件 + Medium 5 件を反映、 Low 6 件は GitHub Issue 化 (v1.4+)。

特筆事項:

- **Opus 4.7 の constraint respect 堅牢性** が Phase 2-4 で実証された (3 round retry で「テスト改竄」誘惑を全 round 回避)
- **silent corruption リスク** が Phase 4 (edge cases) で発覚 → Preflight check 必須化で対処
- **責務分離の不明瞭さ** (skill vs command, workflow vs tracker) が複数 finding で浮上 → spec に責務表追加

## Test data created in Linear

| Type | ID | Title | Status (final) |
|---|---|---|---|
| Issue | TES-1 | [PEV dog food] Implement add(a, b) | Done |
| Issue | TES-2 | [PEV dog food retry-exhaust] | Backlog (期待通り維持) |
| Issue | TES-3 | [PEV dog food child] Add subtract | Done |
| Project | (UUID) | [PEV dog food] Good template project | In Progress |
| Project | (UUID) | [PEV dog food] Bad template project | Backlog |
| Project | (UUID) | [PEV dog food] ステージング即時 deploy | Backlog |

## Findings (28 件、 priority 整理)

### 🔴 High priority (4 件 — v1.3 で反映済み)

| # | Finding | Source phase | Fix |
|---|---|---|---|
| H1 | Preflight check 不在 → silent corruption リスク (`.linear-config.yml` 不在 / team.id 不一致 / status workflow 未確認) | P4-1, P4-2, P4-3 | `linear-project-workflow` に Preflight 節追加 (4 step) |
| H2 | MCP error 分類表 + fallback 規約が不在 (404 / PERMISSION_DENIED / GraphQL errors[] / RATE_LIMIT 等の挙動定義なし) | P2-5, P4-5 | 6 種別 error × skill 挙動 × retry budget の表を `linear-project-workflow` + `pev-linear-sync` に追加 |
| H3 | `artifacts/linear/` 命名規約混在 (UUID dir / identifier.json)、 `sync_state.json` schema 未定義 | P2-3 | `artifacts/linear/{issues|projects}/<id>/sync_state.json` に統一、 `schemas/linear-sync-state.json` で JSON Schema 固定 |
| H4 | `save_comment` (issue 必須) と `save_status_update` (workspace 設定依存) で project 直接 comment 不可 | P1-4 | `linear-project-workflow` Update (C) に 4 段階代替パス (子 issue 経由 → status_update → description embed → skip) |

### 🟡 Medium priority (5 件 — v1.3 で反映済み)

| # | Finding | Source phase | Fix |
|---|---|---|---|
| M1 | parse status enum 未定義 + `[INCOMPLETE]` marker 非標準 | P1-5, P1-6, P4-4 | `FULLY_PARSED / PARTIAL_PARSE / NO_INPUT / PARSE_ERROR` enum + `[LINEAR_INCOMPLETE_<field>]` marker 規約化 |
| M2 | `status_mapping` で Issue/Project state 混在 (Linear では別系統) | P1-5, P4-3 | `.linear-config.yml.example` で `status_mapping.issue` / `.project` を分離、 fallback chain (`Done → Completed → Released`) 明示 |
| M3 | `linear-project-tracker` skill 不在 → child Done 判定が手動 | P3 | 新 skill `linear-project-tracker` を v1.3 で追加 (4 operations: child status 確認 / 完了判定 / AC 突き合わせ / 遷移提案) |
| M4 | inbound flow に parent project context 取り込みなし → Upper-AC が薄い | P3 | `pev-linear-sync` Inbound step 3 に `get_project(projectId)` 追加、 planner に Upper-AC inject |
| M5 | Skill→executor 起動責務 + MCP warmup が暗黙 | P2-3 | `pev-linear-sync` に Responsibility separation 表 + MCP warmup 節追加 |

### 🟢 Low priority (6 件 — v1.4+ Issue 化)

| # | Finding | Source phase | 提案 (v1.4+) |
|---|---|---|---|
| L1 | state `type` field でロケール非依存判定可能だが未活用 | P1-5 | `status_mapping.use_type: true` で type 優先 lookup の option 追加 |
| L2 | `started` 遷移で `startedAt`/`startDate` 自動セットの副作用が spec 未記載 | P1-5 | `sync_state.json.status_transitions[].side_effects[]` に記録規約 (v1.3 で部分実装済、 spec 明文化が L2) |
| L3 | AI 補完箇所の "要確認" 提示 pattern (Phase 1-2) が valuable で規約化候補 | P1-2 | `linear-project-workflow` Write spec に「AI が補完した箇所の確認 table」を必須化 |
| L4 | parent project context inject pattern を planner 規約に昇格 | P3 | `agents/planner.md` に「Linear-sourced input セクション」拡張、 Upper-AC として project context を活用 |
| L5 | `plan.expectFail: true` harness flag (dog food fixture 用) | P2-4 | retry-loop を skip して即 escalate path を test できる flag |
| L6 | スコープ外で `* ` / `- ` 両許容を明示 (Linear が markdown 正規化する場合あり) | P1-1 | spec で「両許容、 parse 時は正規化」と一行明記 |

### 🟢 確認できた良挙動 (実機実証)

- ✅ Opus 4.7 の constraint respect: Phase 2-4 で planner/executor が「テスト改竄」「impl warp」「test exclusion」「it.skip」全誘惑を 3 round 全部回避
- ✅ retry budget 制御正常 (`PEV_MAX_RETRIES=3` → `artifacts/.retry_count` で track)
- ✅ Outbound fail flow 完全 (status 不変 + comment 投稿 + critical_issues + manual intervention 案内 の 4 要素全揃)
- ✅ Gate A enforcement (v0.6) は v1.3 dog food でも正しく機能、 src/index.js への意図しない変更ゼロ
- ✅ AI 補完 "要確認" annotation table (Phase 1-2): SKILL.md spec を超えた賢い挙動
- ✅ targetDate / summary 自動推論 (Phase 1-3): "Q2 まで" → 2026-06-30 quarter resolution の自動変換

## Quantitative observations

| 項目 | 値 |
|---|---|
| 総セッション時間 | 約 1h16min (18:14 - 19:30) |
| Active execution | ~38min |
| dog food log 累計 size | ~29KB |
| 推定 token 消費 | ~80-150K tokens |
| Linear API 呼び出し回数 (推定) | ~50 件 |
| 副作用 (Linear に残った write) | 3 issues + 3 projects + 数件 comment |
| Phase 完了率 | 5/5 (Phase 1-5 全完走) |

## Friction points

1. **Phase 1-4**: `save_comment` が project に投稿不可と判明 → 代替パスを agent が自発的に提案 → spec 化
2. **Phase 2-3**: skill→agent 橋渡しが手動 → Responsibility separation 表で明文化
3. **Phase 2-5**: 404 fallback 規約欠落 → fallback marker 仕様で明文化
4. **artifacts/linear/ 配下の命名混在** → 統一規約 + JSON Schema で固定

## Self-evaluation

| 観点 | 評価 |
|---|---|
| Workflow の自然さ | ★★★★ Read / Preview→Create / Update / Status 遷移は滑らか、 一方 fallback と error 分類は手動判定が必要 |
| Agent 判断ミス頻度 | ★★★★★ 低い、 Phase 2-4 で堅牢性が実証された |
| Skill spec の完成度 | ★★★ (v1.2) → ★★★★★ (v1.3 fix 後の見込み) |
| dog food カバレッジ | ★★★★ 5 phases / 28 findings — happy path / edge / fallback / 統合 を網羅 |

## Next steps

- v1.3.0 release で High 4 + Medium 5 を反映 ← **このcommit**
- Low 6 を GitHub Issue 化 (v1.4+ ラベル)
- `linear-issue-workflow` (v1.4 候補) を別途設計
- 2 回目の dog food session を v1.4 release 前に実施
