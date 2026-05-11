# QA Checklist Template: End-to-End User Flow

E2E test (Playwright 等) でユーザーフローを verify するときの観点 template。

`pev-e2e-verify` skill (v1.4+) と組合せて使う想定。

## 必須項目

### User journey
- [ ] entry point (URL / link / button) から goal までの完走
- [ ] 主要な happy path (登録 / 購入 / 投稿 等)
- [ ] page 遷移が想定通り
- [ ] 各 page で重要な element が表示

### Authentication
- [ ] guest → login → logged-in 状態
- [ ] login → logout → session cleared
- [ ] session 期限切れの挙動
- [ ] 「Remember me」 / persistent session
- [ ] OAuth / SSO の callback handling

### Form workflows
- [ ] 入力 → 送信 → 成功 / 失敗 表示
- [ ] バリデーションエラー → 修正 → 再送信
- [ ] 中断 (戻る / 離脱) 後の再開
- [ ] draft 保存 / 自動 save

### Payment / sensitive flow
- [ ] 確認画面で内容変更不可
- [ ] 二重送信防止 (decisive)
- [ ] 失敗時 (card declined / 3DS challenge) の handling
- [ ] receipt / 確認 mail 送信

### Multi-step wizard
- [ ] 前 step に戻れる (data 維持)
- [ ] 中断・再開可能
- [ ] last step での確認 / 編集

### Realtime / collaborative
- [ ] 別 user の更新が反映される (WebSocket / polling)
- [ ] conflict resolution UI

### Mobile
- [ ] mobile viewport (375 / 414) で操作可能
- [ ] touch target が 44x44 以上
- [ ] keyboard で input field がスクロール隠れない

### Cross-browser
- [ ] Chrome / Firefox / Safari
- [ ] (要件次第) IE11 / legacy Edge

### Performance
- [ ] LCP < 2.5s
- [ ] INP < 200ms
- [ ] CLS < 0.1

### Accessibility
- [ ] keyboard-only navigation で全 page アクセス可能
- [ ] screen reader (VoiceOver / NVDA) で main content 読み上げ
- [ ] color contrast WCAG AA

## オプション項目

### Visual regression
- [ ] screenshot diff (Playwright で `expect(page).toHaveScreenshot()`)
- [ ] design system component の rendering 一致

### i18n
- [ ] 各言語 (en / ja / zh / ar) で page 表示確認
- [ ] RTL layout (アラビア語)

### Offline / PWA
- [ ] offline mode で cached content 表示
- [ ] sync 復旧時の data merge

### Print
- [ ] print preview で必要部分のみ表示

## 使い方

E2E task では plan.md に以下を必ず転記:

```markdown
## Verification strategy

### E2E checklist (from templates/qa-checklists/e2e.md)
- [x] user journey 完走
- [x] form workflow (success / error / back-and-resubmit)
- [x] auth state transitions
- [ ] mobile viewport (← AC が desktop only、 verifier で warning として report)
- [x] keyboard navigation
- [x] console / network error なし
```

`pev-e2e-verify` skill が `npx playwright test --reporter=json` 実行後、 各項目の PASS/FAIL を sync_state.json に記録。 未テスト項目は warning として verify.json に上げる (verifier 親 agent が判定材料に使う)。
