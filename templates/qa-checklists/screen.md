# QA Checklist Template: Screen / UI Implementation

画面実装 (component、 page、 form 等) を verify するときの観点 template。

`pev-test-design` skill が plan.md の Verification strategy に該当項目を転記する。 team / project 固有の項目は `team-conventions.md` の `## QA checklist additions` で拡張可能。

## 必須項目

### 正常系
- [ ] 期待通りのデータ表示
- [ ] 主要な user 操作 (click / input / select) が想定通り動作
- [ ] page 遷移 / state 更新が正しい

### バリデーション
- [ ] 必須項目未入力時のエラー表示
- [ ] 形式エラー (email format / phone format / etc.) の表示
- [ ] 境界値 (max length、 min/max value) の挙動
- [ ] エラーメッセージが human-readable

### ローディング・非同期
- [ ] API call 中の loading 表示 (spinner / skeleton / progress bar)
- [ ] 二重送信防止 (button disabled / loading 中の再 click 抑止)
- [ ] API 完了後の状態反映 (success / error 両方)

### 権限・認可
- [ ] role / permission による表示制御 (ボタン enabled/disabled、 section visible/hidden)
- [ ] 未ログイン状態のリダイレクト
- [ ] 他人の resource への直接アクセス試行 → 403/404

### エラーハンドリング
- [ ] API 失敗時の UI 安定性 (crash しない、 retry 可能)
- [ ] network 切断時の挙動
- [ ] partial failure (UI 成功表示 / 実 DB 未反映) の検出

### データ整合性
- [ ] 表示データと実 DB データの一致
- [ ] 楽観的 UI 更新後の reconcile (response でconfirm or rollback)
- [ ] 並行編集の検出 (version mismatch warning)

### Accessibility (任意、 a11y 重視 project)
- [ ] keyboard navigation (Tab / Enter / Esc) 対応
- [ ] スクリーンリーダー読み上げ可能 (aria-label / role)
- [ ] color contrast (WCAG AA 4.5:1)
- [ ] focus indicator visible

### Responsive
- [ ] mobile (375px width) で layout 崩れなし
- [ ] tablet (768px width) で layout 崩れなし
- [ ] desktop (1280px+) で layout 崩れなし

### Performance
- [ ] page load < 3s on 3G
- [ ] 大量データ (100+ items) で scroll smooth
- [ ] 不要な re-render 抑止 (React profiler / Vue devtools)

### Console / Network
- [ ] console error / warning なし
- [ ] 404 / 500 等の network エラーなし
- [ ] 想定外の追加リクエストなし

## オプション項目 (project 依存)

### Internationalization (i18n)
- [ ] 全 言語の翻訳 key 存在
- [ ] RTL (Right-to-Left、 アラビア語等) layout 対応
- [ ] 数値 / 日付 / 通貨の locale 別フォーマット

### Dark mode / Theme
- [ ] dark mode で全 component visible
- [ ] theme 切替時の transition smooth

### Browser compatibility
- [ ] Chrome / Firefox / Safari で動作
- [ ] (IE11 / Edge legacy が要件なら) 別途確認

### Print
- [ ] print 時に layout 崩れなし
- [ ] 不要な UI (nav, sidebar) が hidden

## 使い方

`pev-test-design` skill が以下のように plan.md に転記:

```markdown
## Verification strategy

### QA checklist (screen)
- [x] 正常系動作確認
- [x] バリデーションエラー表示
- [x] ローディング中の二重送信防止
- [ ] 権限制御の動作 (← AC で扱われていない、 verifier で別途 check)
- [x] API失敗時の UI 安定性
...
```

verifier が各項目を **(a) AC で扱われている → 必ず check、 (b) 扱われていないが項目として重要 → warning として report** で分類する。
