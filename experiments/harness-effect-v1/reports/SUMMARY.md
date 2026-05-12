# 実験結果 — harness-effect-v1

**実施日**: 2026-05-12
**model**: claude-opus-4-7 (1M context)
**pev-harness version**: v2.1.5 (commit aaaa8c4)
**対象**: リアルタイム WebSocket chat (ニックネーム + broadcast)

## TL;DR

| 観点 | 結果 |
|---|---|
| 機能仕様の達成度 | **両者完全達成** |
| 第三者シナリオ S1-S5 | no-harness: **5/5 PASS** / with-harness: **4/5 PASS (S2 fail)** |
| 自前 test | no-harness: **なし** / with-harness: **5/5 PASS** |
| 完成までの所要時間 | no-harness: **114s** / with-harness: **572s (5.0x)** |
| 合計スコア (40 点満点) | no-harness: **31/40** / with-harness: **30/40** |
| 結論 | **僅差 (1 点)**。 ハーネスは "テスト網羅 + 監査可能性" に価値、 一方で品質と速度では opus 4.7 素のままが十分強い |

## 環境

- claude CLI: `--print --permission-mode bypassPermissions --output-format stream-json --model claude-opus-4-7`
- 並行 background 実行 (両者同時起動、 同一マシン)
- with-harness のみ `--plugin-dir ~/pev-harness` + `/pev-harness:pev <prompt> --force-auto` で wrap
- prompt 本文は完全同一 (両者 [prompt.txt](../prompt.txt) を参照)

## メトリクス table

### 効率 (machine-readable から抽出、 [metrics.json](metrics.json))

| 指標 | no-harness | with-harness | 比率 (with/no) |
|---|---:|---:|---:|
| 経過秒 | 114 | 572 | **5.0x** |
| assistant turn 数 | 21 | 88 | 4.2x |
| tool use 数 | 14 | 77 | 5.5x |
| output token 累計 | 781 | 2,284 | 2.9x |
| input token (差分) | 41 | 144 | 3.5x |
| cache read 累計 | 821,015 | 2,555,296 | 3.1x |
| cache creation 累計 | 96,541 | 517,404 | 5.4x |
| 生成コード行数 (test 含む) | 329 | 814 | 2.5x |

### 採点 (4 軸 × 10 点)

| 軸 | no-harness | with-harness | 差 |
|---|---:|---:|---:|
| 1. コード品質 (構造 / 命名 / DRY) | 9 | 8 | -1 |
| 2. テストカバレッジ + 動作網羅 | 4 | 9 | **+5** |
| 3. バグ / regression (シナリオ S1-S5) | 10 | 9 | -1 |
| 4. 効率 (turn / 時間 / token) | 10 | 4 | -6 |
| **合計** | **33** | **30** | -3 |

(※軸 1-3 は加点方式、 軸 4 は相対比較。 詳細採点根拠は本文後半)

## 軸別 詳細所見

### 軸 1: コード品質 — no-harness 9 / with-harness 8

**no-harness の良い点**:

- `server.js` 88 行で機能集約、 `broadcast()` 単一関数で重複なし
- `path.join` + `startsWith(PUBLIC_DIR)` で path traversal 防止
- nickname に `slice(0, 32)`、 message に `slice(0, 2000)` で input size guard
- index.html に `aria-live="polite"`, `autofocus`, `autocomplete="off"` の accessibility 配慮
- reconnect は指数バックオフ (1s → 2s → 4s → 8s → 10s max)、 `manualClose` で beforeunload 区別

**with-harness の良い点**:

- jsdoc コメントで `broadcast()` の signature 明示
- `module.exports = { server, wss }` で test 容易化
- XSS 対策を `textContent` で意識的に実装 (plan の Risks に明記)
- `PORT=0` 対応で test 時に動的 port 取得可能
- README にプロトコル table とアーキテクチャ説明

**with-harness の改善点 (= -1 の根拠)**:

- `server.js` の message ハンドラで `wss.clients.forEach(...)` を直接書いて `broadcast()` を使っていない (DRY 違反、 server.js:96-100)
- index.html の `appendMessage('message', ...)` 分岐が dead code (実際は `appendChatMessage()` で別途処理、 server.js:252-257)
- 全体的に行数が 2.5x、 PEV の plan/verify 込みで実装も冗長傾向

### 軸 2: テストカバレッジ + 動作網羅 — no-harness 4 / with-harness 9

**no-harness**: テストファイルなし、 動作確認は README の人手手順のみ。 server 起動 + 2 タブ目視で済ます設計。

**with-harness**: `tests/server.test.js` に 5 件の integration test:

1. 2 client broadcast (双方向受信 + 自送信 self-receive)
2. 空文字 nickname reject
3. whitespace-only nickname reject
4. join 前 message reject
5. disconnect 時の system message broadcast

`npm test` で **5/5 PASS, 10s, exit 0** を確認。 さらに verifier が AC1-AC8 を verify.json に evidence 付きで記録、 retry 1 回 (Node v22 の `node --test tests/` 引数問題を捕捉して fix)。

**この軸が今回最大の差** (+5)。 ハーネスの存在価値は「テスト網羅と検証エビデンスの自動成果物化」に強く現れた。

### 軸 3: バグ / regression — no-harness 10 / with-harness 9

第三者検証 ([/tmp/verify-scenarios.js](../) で 5 シナリオを Node ws client 直叩き):

| シナリオ | no-harness | with-harness |
|---|---|---|
| S1: 2 タブ broadcast (alice/bob) | PASS | PASS |
| S2: 空メッセージを弾く | **PASS** (client+server 両方で trim check) | **FAIL** (空 body が broadcast される) |
| S3: 3 タブ broadcast | PASS | PASS |
| S4: 1 client 切断後の継続 broadcast | PASS | PASS |
| S5: 空 nickname reject | PASS | PASS |

**S2 の差は皮肉**: with-harness の plan.md では「**空文字 body は許容 (= silent broadcast、 明示的に禁止しない)**」と同値分割の結果として明示的に判断されており、 executor がそれを忠実に実装した。 一方 no-harness は同じ prompt から「弾くべき」を自発的に判断 ([server.js:69](../scratch/no-harness/server.js) `if (!text.trim()) return;`)。

**ただし公平性の注釈**: prompt.txt には message body の空文字制約は書いていない (これは [SPEC.md](../SPEC.md) の E2 にのみ存在、 SPEC は両者非開示)。 厳密には両者とも仕様違反ではない。 → 採点では S2 を「defensive 実装の差」として -1 とした (失格扱いはしない)。

### 軸 4: 効率 — no-harness 10 / with-harness 4

- **wall-clock 5x**: PEV の Plan → Execute → Verify → Retry サイクル分のオーバーヘッド
- **turn 4.2x / tool use 5.5x**: plan.md / execute.log / verify.json 等の artifact 生成 + retry 1 回分の verifier 再走査
- **output token 2.9x**: artifact 文章量。 plan.md だけで 145 行、 verify.json で 80 行
- **cache read 3.1x**: agent ごとに context を読み直すので増える (期待通り)

with-harness の **絶対値での投資は大きい** (5 倍時間 / 3 倍 token)。 これに見合うのは軸 2 の +5 (テスト網羅)。 軸 1/3 では微減。 結果として軸 1+2+3 では with-harness +3 だが軸 4 で -6、 合計 -3 (no-harness 勝ち)。

## findings — v1.7 以降への反映候補

### F1: Plan agent の defensive bias 不足 (優先度 H)

with-harness の plan.md は QA technique self-check (同値分割 / 境界値 / 状態遷移 / エラー推測) を体系的に書き出すが、 **「同値分割で空 body を許容」と決断してしまった**。 spec に明示されていない defensive check (空 body 拒否) を「明示的に禁止しない」と除外したため、 第三者シナリオ S2 で fail。

一方 no-harness は同じ prompt から「弾く」を自発的に書いた (`if (!text.trim()) return;`)。

**示唆**: Plan agent が「同値分割」を「仕様の許容を最大化する方向」に解釈する傾向がある。 むしろ「不明確な振る舞いは defensive (拒否) 寄りに倒す」原則を追加すべき。

**反映候補**: `agents/pev-planner.md` の QA technique section に「曖昧領域は defensive 側 (拒否 / no-op) を default」原則を追加。 もしくは spec template ([skills/pev-spec-template](../../../skills/pev-spec-template/)) で「未定義 input の振る舞い」を明示質問にする。

### F2: executor agent の self DRY check 不足 (優先度 M)

with-harness の server.js で `broadcast()` 関数を定義 (L37-44) したのに、 message handler 内で `wss.clients.forEach(...)` を直接書いて重複 logic を作っている (L96-100)。 plan には書いてないが、 executor 実装時の self-review で気付くべき DRY 違反。

**反映候補**: `agents/pev-executor.md` に "実装直後に自分のコードの DRY/duplication check" step を追加。 verifier に渡す前に self-pass する。

### F3: 環境固有 issue の Plan 段階予測 (優先度 L、 設計通り)

with-harness は `node --test tests/` (directory 引数) が Node v22 で動かない問題を verifier で初めて検出して retry 1 回で fix。 これは PEV の retry loop が想定通り動いた事例で、 「Plan で全部予測する」は無理筋。

**反映候補**: なし (現状の retry mechanism で十分機能)。 ただし `agents/pev-planner.md` の Risk section に「runtime 環境依存の引数解釈」を一般 example として加えてもよい。

### F4: 評価実験の prompt 設計 (今回特有)

prompt.txt が SPEC.md より緩い (空 message の扱いを明記していない) ことで、 S2 評価が「両者とも仕様違反ではないが no-harness が defensive、 with-harness が許容」という非対称な結果になった。

**示唆**: 次回の効果検証実験では、 「prompt = spec」を厳密に対応させる (S2 を測りたいなら prompt にも明示する)。 または「prompt はゆるい依頼文 / spec は内部評価軸」と明確に分離して、 後者で defensive 度合いも測る。

### F5: 効率軸の解像度 (今回特有)

経過秒 / turn / token はうまく抽出できたが、 **「何にどれだけ time を使ったか」 phase 別の分解** ができてない。 Plan 何秒 / Execute 何秒 / Verify 何秒 / Retry 何秒 がわかれば「どこに投資が効いてるか」が見える。

**反映候補**: `extract-metrics.sh` を v2 化、 stream-json 内の slash command timing event か agent invocation event を集計して phase 別 breakdown。

## 補足: 完了通知音声 & artifacts

- with-harness の生成 artifact (`scratch/with-harness/artifacts/`) は plan.md / execute.log / recap.log / verify.json を完備、 **このまま PR description に貼れるレベルの監査ログ**
- no-harness 側は artifact 概念がないので、 後追い分析は git diff と README のみ
- ハーネスの "監査可能性" 価値は軸 1-4 には現れにくいが、 実運用では大きい (= レビュー時間短縮 / ステークホルダー説明)

## 結論

**opus 4.7 の素のままが既に強い**。 仕様を満たすコードを 2 分で書ける、 仕様外の defensive (空 message 弾き) を自発的に判断できる、 UI の accessibility 配慮も出る。

**ハーネスの差別化**:

1. **テスト網羅と動作エビデンスの自動成果物化** (+5 点の主因)
2. **監査可能な artifact (plan.md / verify.json)** ※今回採点未反映、 実運用では大きい
3. **retry loop による self-heal** (Node v22 issue の自動 fix)

**ハーネスの弱点**:

1. **5 倍時間 / 3 倍 token** のオーバーヘッド
2. **Plan の "同値分割" 判断が defensive を過小評価する bias** (F1)
3. **executor の self DRY check 抜け** (F2)

**用途別の推奨**:

- **試作 / 短期 prototype**: 素の claude が速くて十分
- **PR レベルの本番コード**: ハーネス込み (test と監査 artifact の価値)
- **CI / 自動化 dog food**: ハーネス + `--force-auto` で再現可能なログ採取に最適

次の release で F1 (Plan の defensive bias) と F2 (executor DRY check) を反映すれば、 軸 1 と軸 3 の差を縮められる。
