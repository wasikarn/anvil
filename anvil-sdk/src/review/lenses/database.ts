export const DATABASE_LENS = `
# Database Review Lens

Inject into reviewer prompts when diff touches: migrations, ORM queries, raw SQL, or repository layer code.

\`\`\`text
DATABASE LENS (active for this review):

UNSAFE MIGRATION — Hard Rule (flag unconditionally):
- \`DROP COLUMN\` / \`DROP TABLE\` without verified zero-traffic or backup
- \`ALTER COLUMN\` changing type on populated column without data migration step
- Adding \`NOT NULL\` column without \`DEFAULT\` on live table (locks entire table)
- Removing column in same migration as adding its replacement → ZDT violation
  (removal must be separate migration after code stops reading old column)

ZERO-DOWNTIME MIGRATION (expand/contract):
Step 1: add nullable column, deploy code reading both old+new
Step 2: backfill in batches (see DATA MIGRATION below)
Step 3: add NOT NULL + default, drop old column in separate migration

DATA MIGRATION — batch required for large tables:
- Single \`UPDATE table SET ...\` without LIMIT loop → table lock for duration
  Fix: batch loop \`WHERE id IN (SELECT id ... LIMIT 1000)\` — must be idempotent
- Data migration in same transaction as DDL → lock held for entire backfill

INDEX TYPE CORRECTNESS:
- FK column without index — also check composite FK
- JSONB column filtered/searched → GIN index, not B-tree
- Full-text search on \`text\` → GIN with \`to_tsvector\`, not \`LIKE '%term%'\`
- Composite index: high-cardinality / equality columns first, range column last
- Partial index opportunity: query always filters same subset (e.g. \`WHERE deleted_at IS NULL\`)

DEADLOCK RISK:
- Multiple tables modified in inconsistent order across code paths
  (TX-A: users→orders; TX-B: orders→users → deadlock)
  Fix: canonical lock order (alphabetical or dependency-based)

QUERY ANTI-PATTERNS (conf ≥75):
- Function in WHERE prevents index: \`WHERE YEAR(col)=2024\` → range condition;
  \`WHERE UPPER(email)='X'\` → store normalized or use functional index
- Correlated subquery per row → rewrite as JOIN or window function
  (\`AVG(price) WHERE category = p.category\` → \`AVG() OVER (PARTITION BY category)\`)
- \`LEFT JOIN\` when \`INNER JOIN\` semantics intended → wrong results + performance hit
- \`IN (SELECT id FROM ...)\` on large subquery result → \`EXISTS\` or JOIN
- Multiple separate \`COUNT(*)\` per status → single conditional aggregation

EXISTING (conf ≥75):
- SELECT *: specify columns explicitly
- OFFSET pagination on large table → cursor/keyset pagination
- Missing transaction: multiple related writes without atomic guard
- N+1 ORM: query in loop → \`.include()\` / \`.with()\` eager load
- Missing DB-level constraint: unique/FK enforced only in application code
- Unbounded query: collection without LIMIT
\`\`\`
`
