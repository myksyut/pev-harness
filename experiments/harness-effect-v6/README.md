# harness-effect-v6 — v3.0.2 dog food (F_v5_1 patch 効果検証)

**実施日**: 2026-05-13
**predecessor**: harness-effect-v5/ (v3.0.0 baseline、 F_v5_1 検出)
**target**: 同じ申込キャンセル機能 task を v3.0.2 (= F_v5_1 patch 適用済) で再走、 confirm dialog の質問が plan で出るか検証
**spec / virtual-user / prompt**: v5 と同じ (= 内心 spec / 応答ルール / 中曖昧 prompt をそのまま再利用)

## 観点

| 観点 | v5 結果 (v3.0.0) | v6 期待 (v3.0.2) |
|---|---|---|
| Plan の confirm dialog 質問 | ✗ (全 (a) 自己採用) | ✓ (F_v5_1 patch で質問対象に) |
| 内心 spec 一致率 | 12/15 (Q4 confirm 漏れ) | 13+/15 |
| AC2 (confirm dialog) | ✗ | ✓ |
| 合計スコア | with-harness 37.5 | 39+? |

## ファイル

- `spec.md` / `virtual-user.md` / `prompt.txt` — v5 から copy
- `reports/SUMMARY.md` — v6 走行後に書き出し
