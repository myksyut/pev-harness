# 実験結果 — harness-effect-v1 (v2 run)

**実施日**: 2026-05-12 (v2)
**pev-harness version**: v2.1.6 (F1/F2/F4/F5 反映後の re-run)
**target**: リアルタイム WebSocket chat
**v1 → v2 の差分**: agents/planner.md に Defensive default 原則 (F1)、 agents/executor.md に DRY self-review (F2)、 prompt.txt を SPEC.md と 1:1 (F4)、 extract-metrics-v2.py で phase 別 breakdown (F5)

## TL;DR

| 観点 | v1 結果 | v2 結果 |
|---|---|---|
| シナリオ S1-S5 (no-harness) | 5/5 PASS | **5/5 PASS** |
| シナリオ S1-S5 (with-harness) | **4/5 PASS (S2 fail)** | **5/5 PASS** |
| with-harness retry 回数 | 1 | **0 (一発 pass)** |
| 合計スコア (40 満点) — no-harness | 33 | 33 |
| 合計スコア (40 満点) — with-harness | 30 | **33** |
| 差 | -3 (no-harness 勝) | **0 (タイ)** |
| 定性的価値 | 軸 1-3 で no-harness 互角、 軸 2 のテスト網羅は with-harness 圧勝 | 軸 1-3 で **同点 + 監査 artifact** で with-harness 優位 |

**結論**: F1/F2 反映で with-harness の S2 fail が解消、 軸 1/3 でも品質改善。 効率コスト (軸 4) は依然として高いが、 同点に持ち込めるレベルに。 用途別の使い分け推奨は不変。

## 環境

- claude CLI: `--print --permission-mode bypassPermissions --output-format stream-json --model claude-opus-4-7`
- prompt 本文: [prompt.txt](../prompt.txt) (v2、 SPEC.md と 1:1)
- 並行 background 実行、 同一マシン、 wire format は両者 `msg.text` で統一

## メトリクス — v1 vs v2 比較

### 効率 (machine-readable)

| 指標 | no-harness v1 | no-harness v2 | with-harness v1 | with-harness v2 |
|---|---:|---:|---:|---:|
| wall-clock elapsed | 114s | 215s | 572s | 625s |
| assistant turn 数 | 21 | 28 | 88 | 82 |
| tool use 数 | 14 | 21 | 77 | 74 |
| output token 累計 | 781 | 1,551 | 2,284 | 3,451 |
| cache creation 累計 | 96,541 | 109,052 | 517,404 | 416,830 |
| retry 回数 | — | — | 1 | **0** |
| 生成コード行数 (test 含む) | 329 | 489 | 814 | 869 |
| with/no 経過秒比 | — | — | 5.0x | **2.9x** |

### Phase 別 breakdown (with-harness v2、 F5 で新規取得)

| phase | invocations | turn | tool_use | output_tok | cache_create |
|---|---:|---:|---:|---:|---:|
| plan | 1 | 12 | 12 | 1,021 | 61,154 |
| execute | 1 | 23 | 23 | 493 | 56,479 |
| verify | 1 | 20 | 20 | 630 | 77,721 |
| main (orchestration) | 1 | 27 | 19 | 1,307 | 136,757 |
| **total** | 4 | 82 | 74 | 3,451 | 332,111 |

**読み取り**: main session (= /pev コマンド自身の orchestration) が **token の 38%、 turn の 33%** を占めている。 Plan/Execute/Verify の subagent invocation よりも main の overhead が大きい。 これは Plan agent が opus-xhigh で深く考えるため subagent 内 output が少なく、 main がそれを受けて artifact 構築 / next phase 起動 / status report を打つため。

recap.log の総 span は 382s (= Phase 1 開始 → Phase 3 完了)、 wall-clock 625s との差 243s は main orchestration + npm install 等の overhead。

## 採点 — v1 vs v2

| 軸 | no-harness v1 | no-harness v2 | with-harness v1 | with-harness v2 |
|---|---:|---:|---:|---:|
| 1. コード品質 (構造/命名/DRY) | 9 | 9 | 8 | **9** |
| 2. テストカバレッジ + 動作網羅 | 4 | 4 | 9 | **10** |
| 3. バグ / regression (S1-S5) | 10 | 10 | 9 | **10** |
| 4. 効率 (turn/時間/token) | 10 | 10 | 4 | 4 |
| **合計** | **33** | **33** | **30** | **33** |

## 軸別 — v2 詳細所見

### 軸 1: コード品質 — 両者 9

**no-harness v2 の構成変化**:

- v1 では Node 標準 `http` 単体、 v2 は **express + ws** へ移行 (static 配信が express.static で 1 行に圧縮、 path traversal は library が担保)
- `safeSend()` helper で `readyState OPEN` check と try/catch を一元化、 broadcast でも同じ防衛
- error reason の string 化 (`empty_nickname` / `empty_message` / `invalid_json` / `must_join_first` / `unknown_type`) → client 側の分岐を容易に
- reconnect は exponential backoff (`3000 * 2^n`, max 5 retries) — v1 と同等

**with-harness v2 の構成変化**:

- F2 効果: server.js / index.html 両方で `broadcast()` `safeSend()` `appendMessage()` `appendSystemMessage()` 等の helper を **一元化**、 forEach 直書きなし
- execute.log に **"DRY check — server.js" / "DRY check — public/index.html"** の section が新設、 4 観点 (重複 / dead import / dead branch / dead comment) を 1 つずつ自己 review
- v1 で見られた `wss.clients.forEach()` を `broadcast()` の外で再実装する DRY 違反は今回ゼロ

### 軸 2: テストカバレッジ + 動作網羅 — no-harness 4 / with-harness 10

**no-harness**: v1 と同様、 自前 test ファイルなし。 README の動作確認手順のみ。

**with-harness**: `artifacts/ws-test.mjs` (402 行) に **S1-S5 + A11 (join 前 send) + A12 (不正 payload)** の 7 件 integration test を配置。 verifier が `PORT=3001` で server を spawn、 全テストを実機 invoke して PASS 確認。 verify.json の `checks[].tests.detail` に「All 7 tests passed: S1 PASS, S2 PASS, S3 PASS, S4 PASS, S5 PASS, A11 PASS, A12 PASS」 と記録。

**v1 → v2 改善ポイント**: v1 では `tests/server.test.js` だったが、 v2 では `artifacts/ws-test.mjs` (Phase 3 verifier 専用の自己検証 script) に移動。 これは「test は project 永続 asset」ではなく「verifier の証跡」という位置付け。 用途分離としては妥当 (test が必要なら別途 plan で指示)。

### 軸 3: バグ / regression — 両者 10

シナリオ第三者検証 ([reports/verify-scenarios-v2.js](verify-scenarios-v2.js)):

| シナリオ | no-harness v1 | no-harness v2 | with-harness v1 | with-harness v2 |
|---|---|---|---|---|
| S1 (2-tab broadcast) | PASS | PASS | PASS | PASS |
| S2 (empty rejected) | PASS | PASS | **FAIL** | **PASS** |
| S3 (3-tab broadcast) | PASS | PASS | PASS | PASS |
| S4 (disconnect resilient) | PASS | PASS | PASS | PASS |
| S5 (empty nickname rejected) | PASS | PASS | PASS | PASS |

**v1 → v2 の最大改善**: with-harness S2 が FAIL → PASS。 plan.md に **Defensive defaults (unspecified input)** section が新設され、 7 件の defensive default (空 body 拒否含む) が明示列挙された結果、 executor が server.js に `isValidMessage()` を実装、 verifier が integration test で確認。 F1 directive がそのまま発動した形。

### 軸 4: 効率 — no-harness 10 / with-harness 4

- with-harness の wall-clock 倍率は **5.0x → 2.9x** に縮小 (prompt 複雑化で no-harness の時間も伸びたため、 ハーネスの相対 overhead が薄まった)
- with-harness retry が 1 → 0 になり、 verify-side の効率も改善 (一発 pass)
- ただし合計 turn / token 量は依然として高く、 軸 4 のスコアは 4 のまま

## F1-F5 反映の効果サマリ

### F1 (Plan の defensive bias) — ✅ 完全に機能

- plan.md に **"Defensive defaults (unspecified input)" section** が出現
- 7 件の defensive default を 明示列挙 (empty nickname / empty body / join 前 send / 不正 JSON / 二重 join / 巨大 payload / OPEN 前 send)
- AC に **"Defensive / robustness AC" (A9-A13) section** を新設
- 結果: S2 シナリオ FAIL → PASS

### F2 (executor の DRY self-review) — ✅ 完全に機能

- execute.log に **"DRY check — server.js" / "DRY check — public/index.html" section** が出現
- 4 観点 (helper 一元化 / dead import / dead branch / dead comment) を自己 review
- broadcast() 関数の重複実装 (v1 finding) が解消
- 結果: 軸 1 が 8 → 9 に改善

### F4 (prompt = SPEC) — ✅ 機能

- v2 prompt.txt は SPEC.md の必須 AC を全て含む (S1-S5 / E1 reconnect / E2 空 message 拒否を必須側に明示)
- 結果: 両者が同じ要件に向かう、 評価軸 S2 の公平性確保

### F5 (phase 別 breakdown) — ✅ 機能

- extract-metrics-v2.py で task_started / task_notification + parent_tool_use_id でグルーピング
- 結果: with-harness の **main session が token 38%、 turn 33% を占める** ことが可視化
- 派生 finding: **F6 候補** — main orchestration が PEV の overhead 主要因。 stop hook / 状態 polling 等の sequence を見直す余地

## 新規 finding (v2 run から)

### F6 (新規): main session の orchestration overhead が大きい

phase breakdown で、 main session (= /pev command 自身) が **token 38% / turn 33% を消費**。 Plan/Execute/Verify subagent の合計より大きい。

**仮説**:

- recap.log への append、 .task_id / .retry_count の維持、 next phase の prompt 構築、 status print 等の orchestration が主因
- Plan agent が opus-xhigh で thinking 深い分、 subagent output token 自体は控えめ (Plan 1021 tok / Verify 630 tok)、 一方 main がそれを受けて長い user-facing report を組む

**改善候補**:

- main の status print を最小化 (現状 recap.log にも書き、 stdout にも書く、 重複)
- stop hook での verify trigger を skill 内に inline 化、 main の往復を削減

優先度 M (低くはないが、 機能改善のほうが先)。 v2.2 以降の検討候補。

### F7 (新規、 質的): with-harness の monitoring artifact が「PR description にそのまま貼れる」レベル

v2 で verify.json は AC 14 件 + シナリオ 5 件 + suggestions 3 件 + issues 0 件の構造化レポート。 execute.log は DRY check 4 観点を file 別に記録、 plan.md は Test design analysis section に QA 5 技法 + Defensive defaults 7 件。

**示唆**: これは採点軸には現れにくいが、 PR レビュー時間短縮 / ステークホルダー説明 / オンコール tracking 等の **実運用で大きな価値** を生む。 SUMMARY 中の「監査可能性」の論点を更に強化する材料。

## 結論 — v1 vs v2

v1 では「opus 4.7 素のままが既に強い、 ハーネスはテスト網羅と監査 artifact で差別化、 ただし 5x 時間 / 3x token のコストが高い」 だった。

v2 では:

1. **F1 反映で品質差が逆転** — with-harness が S2 で defensive 弱点を持っていたが、 plan の Defensive defaults 列挙でハーネスなしと同等以上に。 「ハーネスありの方が仕様逸脱する」 という本末転倒が解消
2. **F2 反映でコード品質が改善** — DRY check が明示作業に。 軸 1 で同点に到達
3. **効率 overhead は依然存在** だが、 prompt 複雑化に対するスケール感が見えた (no-harness 1.9x / with-harness 1.1x、 ハーネスのほうが prompt 複雑化耐性は高い)
4. **同点 (33-33) + 監査 artifact 完備** で、 PR レベル本番コードでは with-harness が実質優位

### 用途別推奨 (v2 でも維持、 補強あり)

- **試作 / 短期 prototype**: 素の claude (no-harness) で十分、 速い
- **PR レベル本番コード**: ハーネス込み、 監査 artifact (plan.md / verify.json / execute.log の DRY check section) が PR description に直結
- **CI / 自動化 dog food**: ハーネス + `--force-auto` で再現可能なログ採取
- **複雑な仕様 / 多数の境界条件**: ハーネス込みが defensive 補完で safety net (F1 効果)

## 残課題

- F6 (main orchestration overhead) — v2.2 以降で取り組み
- 効率軸の絶対値改善 — Plan の thinking budget を仕様サイズに連動させる仕組み 等
- 他のアプリ種別での再検証 — 今回は WebSocket chat (中規模)。 CRUD / dashboard / data pipeline でも同様の比率が出るか
