# QA Checklist Template: API Endpoint

REST / GraphQL / RPC endpoint を verify するときの観点 template。

## 必須項目

### Contract
- [ ] OpenAPI / GraphQL schema が定義されている
- [ ] request body の field 型 / required / optional が schema 通り
- [ ] response body の field 型 / required / optional が schema 通り
- [ ] HTTP status code が用途に対応 (200/201/204/400/401/403/404/409/422/500)

### Happy path
- [ ] 正常 input で正常 response
- [ ] DB / storage への書き込みが想定通り
- [ ] 副作用 (email 送信、 webhook、 event publish) が発火

### バリデーション
- [ ] 必須 field missing → 400 (validation error)
- [ ] 型不一致 (string が来るべきところに int) → 400
- [ ] 範囲外値 (negative / overflow) → 400
- [ ] エラーメッセージが debug 可能な詳細さ (production では PII を出さない)

### 認証・認可
- [ ] 未認証 → 401
- [ ] 認証済みだが権限不足 → 403
- [ ] 他人の resource アクセス試行 → 403 or 404 (info leak 注意)
- [ ] role-based / attribute-based 制御の境界 case

### Rate limiting
- [ ] rate limit 超過 → 429
- [ ] retry-after header 含む
- [ ] login endpoint の brute force 対策

### Concurrency
- [ ] 並行 update で last-write-wins / optimistic lock
- [ ] idempotency-key で 二重 request 冪等
- [ ] transaction の atomicity (partial failure 無し)

### Performance
- [ ] p95 latency 目標値 (例: 300ms) 内
- [ ] N+1 query 検出 (DB log で query count 確認)
- [ ] 大量 data (1000+ rows) で stable

### Security
- [ ] SQL / NoSQL injection 試行で防御 (`' OR 1=1`)
- [ ] XSS の input → server 側で sanitize or escape
- [ ] CSRF token 検証 (cookie auth の場合)
- [ ] CORS が想定 origin のみ許可
- [ ] sensitive data (password / token) が log に出ない

### Error handling
- [ ] DB 接続 fail → 500 + retry 可能なメッセージ
- [ ] timeout → 504
- [ ] dependency (external API) fail → graceful degradation

### Observability
- [ ] 全 request に request-id (correlation ID)
- [ ] error は structured log (machine-readable)
- [ ] metrics (request count / latency / error rate) emit
- [ ] trace (distributed tracing) 対応

### Versioning
- [ ] API version (URL path or header)
- [ ] breaking change には新 version
- [ ] deprecated endpoint は X-Deprecated header

## オプション項目

### Webhook
- [ ] retry policy (exp backoff)
- [ ] signature verification
- [ ] dead letter queue

### Batch / Bulk
- [ ] 部分 失敗時の atomic / per-item rollback policy
- [ ] 大量 input (10000+ items) の chunk 処理

### File upload
- [ ] file size 制限
- [ ] mime type 検証
- [ ] virus scan (option)
- [ ] storage 別経路 (signed URL / S3 multipart)

### GraphQL 特有
- [ ] query depth 制限 (DoS 防止)
- [ ] N+1 (dataloader 使用)
- [ ] field-level permission

### gRPC 特有
- [ ] proto file の backward compat
- [ ] streaming (server / client / bidirectional) の cancel
