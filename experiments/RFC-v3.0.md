# RFC — pev-harness v3.0 設計の根本見直し

**Status**: Draft
**Author**: claude (orchestrator) + user
**Date**: 2026-05-12
**Predecessor**: v2.1.6 (現状の最新)
**Driver**: harness-effect-v1 / v2 / v3 / v4 実験結果から抽出した構造的問題

## 1. 動機 — v1-v4 実験で見えた事実

| 実験 | task 性質 | no-harness 軸 1-4 計 | with-harness 軸 1-4 計 | 勝者 |
|---|---|---:|---:|---|
| v1 | 明確 spec + 新規 (WebSocket chat) | 33/40 | 33/40 | タイ |
| v2 | 中曖昧 + text input (TODO) | 27/40 | 22/40 | no-harness |
| v3 | 中曖昧 + stream-json input (TODO) | 27/40 | **28/40** | with-harness |
| v4 | 中曖昧 + 既存 codebase (申込フォーム) | **29/40** | 25.5/40 | no-harness |

**観察される構造的問題**:

1. **ハーネスが勝つ条件は厳しい**: 「曖昧 spec + zero context + interactive channel 確保」 の 3 つ全部揃わないと逆効果。 実務で 3 つ揃うケースは多くない
2. **質問返し channel の脆弱性**: text input mode で発動しない (F_v2_1)、 既存 codebase ある時は agent 自己判断で skip (F_v4_3)
3. **F1 Defensive default の副作用**: v2.1.6 で導入。 v1 / v3 では意義あったが、 v4 で **minimal interpretation 過剰** (= counter UI を Non-goal に倒した) を引き起こす
4. **効率コストが回収されない**: 12-18x time、 4-8x turn、 2-10x token。 v4 の実務 task ですら品質差を逆転されない
5. **3-phase 固定の overkill**: v1 / v4 のような明確 spec / 既存 codebase task で Plan が overhead 化

## 2. v3.0 が解決すべき問題

| 問題 | 現状 (v2.1.6) | 期待される v3.0 挙動 |
|---|---|---|
| P1: 質問返しが context 依存で skip される | planner が「情報十分」 と誤判定して質問せず | 質問判定基準を明示、 不明確 spec 領域があれば必ず質問 |
| P2: Defensive default が minimal interpretation を生む | 「明示なし → Non-goal」 で feature 漏れ | Non-goal 判定の前に確認質問を必須化 |
| P3: 3-phase 固定が overkill | task 種別に関係なく Plan/Execute/Verify 走る | task 性質に応じて lite / standard / strict から選択 |
| P4: 既存 codebase 推測力が無駄になる | planner が「既存 pattern + spec minimal」 で進む | 既存 codebase あれば「pattern 踏襲 + 高 ambiguity 領域だけ質問」 |
| P5: 効率コスト | 12-18x の overhead | lite mode で no-harness と同等 + 監査 artifact のみ追加 |

## 3. 設計選択肢 (案、 これを user と詰める)

### 案 A: Phase 0 (Clarify) を first-class 導入

PEV の前に **Clarify phase** を追加 → CEPV (Clarify → Execute → Plan → Verify) もしくは PCEPV。

- Clarify agent が初期 prompt を分析、 「明確な点 / 不明確な点」 を列挙
- 不明確が N 個以上なら「質問返しモード」、 N 個未満なら「明確モード」 (skip)
- 質問返しの prompt は input mode に依存しない (channel 確保戦略を別途実装)

**利点**: 質問返し挙動が明示的、 planner agent の負担減
**懸念**: phase 増えて overhead 増、 N の閾値 tuning が難しい

### 案 B: 3-phase の optional 化 (lite / standard / strict mode)

`/pev <task> --mode=lite|standard|strict` で選択:

| mode | flow | 用途 |
|---|---|---|
| lite | Plan skip、 直接 Execute → Verify | v1 / v4 のような明確 task / 既存 codebase |
| standard | 現状の PEV (Plan → Execute → Verify) | v3 のような曖昧 task、 PR レベル |
| strict | Clarify → Plan → dual review → Execute → strict Verify → retry | production critical、 v1.5 dual review 含む |

auto-classify: task の長さ / 既存 codebase 有無 / spec 明確度 で mode を推奨

**利点**: 効率 / 品質のバランスを user が制御可能
**懸念**: user 教育コスト、 mode 選択ミスのリスク

### 案 C: Defensive default の scope 限定 + Non-goal 判定の質問必須化

F1 (v2.1.6) を refine:

- F1 適用領域を「security / data integrity / 状態不整合」 に限定
- 「UI feature / nice-to-have / 表示 detail」 については「Non-goal 判定の前に 1-2 個確認質問」 を義務化
- 既存 codebase からの推測拡張は「許容 default」 (= Q4 のような counter UI 漏れを防ぐ)

**利点**: 最小変更で v4 問題を解決
**懸念**: F1 の境界が曖昧、 LLM の判定ばらつき

### 案 D: Inline interactive mode の標準化

- 現状 `--input-format stream-json` を明示する必要 (= 多くの user は知らない)
- v3.0 で「ハーネス invoke 時は **自動的に stream-json input mode**」 をデフォルト化
- helper script `bin/pev` を提供、 `pev "<task>"` で自動 wrap

**利点**: v2 (text input で質問 skip) 問題を解決
**懸念**: stream-json input は CI / 自動化 で不向き、 force-auto との共存設計が必要

### 案 E: ハーネスを "guard rail" に再定義 (= passive モード)

最も radical な選択肢。

- 現状: ハーネスが Plan / Execute / Verify を **能動的に駆動**
- v3.0: ハーネスは「**素 claude が書いた成果物に対する verify / audit / pattern check**」 に絞る
- Plan は user が書く、 Execute は素 claude、 Verify と監査だけハーネスが担当
- v1-v4 で見たように 素 claude の implementation は概ね質高い、 ハーネスは「実装後の品質保証」 に特化

**利点**: 効率コスト劇的削減 (turn 数 1/10 にできる)、 ハーネスの value が「監査」 に明確化
**懸念**: 既存 PEV flow を捨てる = breaking change、 user 教育コスト大

## 4. 推奨される組み合わせ (案、 user 確認したい)

**Combo X (穏当)**: 案 B + 案 C
- lite / standard / strict mode 導入
- Defensive default を refine

**Combo Y (中庸)**: 案 A + 案 B + 案 C
- Clarify phase + mode 化 + Defensive refine

**Combo Z (radical)**: 案 E をベースに、 必要部分だけ案 A / B を組み合わせる
- "audit-only" mode を default に、 PEV は opt-in

## 5. 確認したい点 (user に判断委ね)

1. **方向性**: 上記 案 A-E のうち、 どれを採用するか? (もしくは別案)
2. **scope**: v3.0 で全部やる? それとも段階的 (v3.0 → v3.1)?
3. **migration**: v2.x user に対する breaking change の許容度
4. **timeline**: v3.0 の release は急ぐ? じっくり?
5. **既存 commit**: v2.1.6 (F1-F5 + harness-effect-v1) を pre-v3 として今 commit するか / v3.0 と一括するか

## 6. 不確実性

- 上記設計は v1-v4 の **4 サンプル** から導出。 実務 task は無限の variation あり、 4 サンプルで全部を語るのは尚早
- 案 E (audit-only) は radical だが、 「ハーネスの本当の value」 を再定義する好機の可能性
- F1 を refine するか、 削除するか、 残すかは v4 結果以外の data を取らないと確定困難

→ 「v3.0 で何を解くか」 を絞り込むのが最初の判断。
