# QA Checklist Template: Database / Migration

DB schema 変更、 migration、 data 操作の verify 観点。

## 必須項目

### Migration safety
- [ ] forward migration が一度で成功する
- [ ] rollback (down migration) が定義されている
- [ ] production data sample で dry-run 済 (例: staging)
- [ ] 既存 application が migration 中に動く (zero-downtime)

### Schema integrity
- [ ] NOT NULL constraint が新規 column で default 値 OR backfill 後に適用
- [ ] FOREIGN KEY が整合 (orphan row なし)
- [ ] UNIQUE constraint が違反しないことを既存 data で確認
- [ ] index が必要な query path をカバー

### Performance
- [ ] migration が大規模 table (1M+ rows) で acceptable な時間内
- [ ] online migration (CREATE INDEX CONCURRENTLY 等) を使用
- [ ] 重い query (ALTER TABLE on large table) は事前に impact 評価

### Data integrity
- [ ] backfill が transaction 内で実行 (or batch + 冪等)
- [ ] data の loss / duplicate を防ぐ (BEFORE/AFTER count 検証)
- [ ] timestamp / uuid の生成は server 側か DB DEFAULT か明確化

### Backward compat
- [ ] 旧 application code でも動作する (rolling deploy 中)
- [ ] column rename は (1) 新 column 追加 (2) dual write (3) cutover (4) 旧 column削除 の段階移行
- [ ] enum 追加は前方互換、 削除は旧 value が消えてから

### Security
- [ ] sensitive column (password、 PII) は暗号化 OR 別 table に分離
- [ ] backup から restore できる
- [ ] DB user permission (read-only / read-write) が適切

### Rollback plan
- [ ] migration が失敗した場合の手順 documented
- [ ] data loss なしで rollback 可能 (or 受容可能な loss を明示)
- [ ] rollback 試行を staging で実施済

## ORM 特有 (Prisma / Drizzle / TypeORM)

- [ ] schema.prisma の DB 状態と同期 (drift なし)
- [ ] generated migration が手で確認済 (auto-generated SQL を盲信しない)
- [ ] seed script が新 schema で動作

## オプション項目

### Sharding / partitioning
- [ ] shard key が均等分散
- [ ] cross-shard query の代替手段

### Replication
- [ ] replica lag tolerable
- [ ] read replica へ routing 漏れ

### Backup / restore
- [ ] daily backup が動いている
- [ ] point-in-time recovery 試行済

### Audit log
- [ ] sensitive table の write は audit log に記録
- [ ] log の retention policy

## 使い方

migration task では plan.md に以下を必ず転記:

```markdown
## Verification strategy

### Migration verification (from templates/qa-checklists/db.md)
- [x] forward + rollback 試行 (staging)
- [x] zero-downtime 確認
- [x] BEFORE/AFTER count 検証 (data loss なし)
- [x] sensitive column 暗号化
- [ ] rollback plan documented (← AC で扱われていない、 別途 check)
```
