# optimize-context — Good/Bad Examples

Concrete before/after CLAUDE.md examples. Anti-pattern catalog: [`audit-antipatterns.md`](audit-antipatterns.md). Compression techniques: [`compression-guide.md`](compression-guide.md).

---

## Noise — Content That Changes No Behavior

### ❌ Bad — generic best practices, obvious defaults, aspirational

```markdown
## Development Guidelines

Always write clean, readable code. Make sure to test your changes before committing.
Be careful with database operations. Follow the project's coding standards.
We strive for high quality and maintainability in all our code.

## Architecture
Next.js uses the `pages/` directory for routing. Components go in `components/`.
API routes are in `pages/api/`. Make sure to follow Next.js conventions.
```

### ✅ Good — only non-obvious, behavior-changing instructions

```markdown
## Architecture

Custom auth middleware: `src/middleware/auth.ts` — skips verification for
`/api/health` and `/api/webhook/*`. Do NOT add JWT check to these paths.

## Database

Migrations run via `node ace migration:run` — `db:push` is not available.
Always run `node ace migration:fresh --seed` in dev after schema changes.
```

**Why the bad version fails:** Claude already knows Next.js routing, generic best practices add tokens without changing behavior. The good version contains non-obvious project specifics Claude cannot infer from code.

---

## Stale Content — Breaks Agent Behavior

### ❌ Bad — dead path, renamed command, wrong version

```markdown
## Commands

Run tests: `npm run test:unit`
Build: `yarn build`
Docs: see `docs/architecture.md`

## Tech Stack

- Node.js 16
- AdonisJS 5.3
```

**What went wrong:**

- `npm run test:unit` → script renamed to `test` in package.json
- `yarn build` → project uses `npm`, not `yarn`
- `docs/architecture.md` → file moved to `agent_docs/architecture.md`
- Node 16 → project is on Node 24
- AdonisJS 5.3 → project is on 5.9

### ✅ Good — verified against actual codebase

```markdown
## Commands

| Task | Command |
| --- | --- |
| Run tests | `node ace test` |
| Build | `npm run build` |

## Tech Stack

- Node 24 · AdonisJS 5.9 · TypeScript strict
- Docs: see `agent_docs/architecture.md`
```

---

## Compression — Tables Over Prose

### ❌ Bad — 8 lines of prose for a simple lookup

```markdown
When you need to interact with Jira, you should use the MCP tools that are available.
For reading a specific issue, use jira_get_issue with the issue key. When you need
to search for issues, use jira_search with a JQL query. To add a comment to an issue,
use jira_add_comment. Make sure to always use the MCP tools and not the CLI for Jira.
```

### ✅ Good — 5 lines as a table

```markdown
| Operation | Tool |
| --- | --- |
| Read issue | MCP `jira_get_issue` |
| Search | MCP `jira_search` (JQL) |
| Add comment | MCP `jira_add_comment` |
```

---

## Absolute Directives — Reduces Adaptability

### ❌ Bad — absolute framing, IMPORTANT overuse

```markdown
IMPORTANT: You MUST always run tests before committing.
IMPORTANT: Never use `as any` in TypeScript code.
IMPORTANT: Always check the existing codebase before adding new files.
IMPORTANT: You MUST follow the project's naming conventions at all times.
```

**Problems:**

- 4 `IMPORTANT:` items → none stands out
- "You MUST always" → agent treats as hard constraint even in legitimate exceptions
- "Never use `as any`" → blocks cases where it's warranted (e.g., third-party lib type gap)

### ✅ Good — prefer/avoid framing with rationale

```markdown
## Non-Negotiables

Avoid `as any` — use type guards or `unknown`. Exception: third-party libs with missing types
(add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment explaining why).
```

---

## Missing Retrieval Directive

### ❌ Bad — framework project with no retrieval hint

```markdown
## Stack

AdonisJS 5.9, TypeScript, Lucid ORM
```

### ✅ Good — retrieval directive + docs index

```markdown
## Stack

AdonisJS 5.9 · TypeScript strict · Lucid ORM
Prefer retrieval-led reasoning for AdonisJS tasks — docs in `agent_docs/adonisjs/`.

[AdonisJS Docs Index]|root: ./agent_docs/adonisjs
|01-guides:{http-context.md,middleware.md,validation.md}
|02-orm:{lucid-models.md,relationships.md,query-builder.md}
```

---

## Migration Tombstones — Historical Noise

### ❌ Bad — completed migrations documented as active instructions

```markdown
## Environment Variables

~~MONGO_URI~~ was renamed to MONGODB_URL in v3.0 (2023).
Previously we used `validators/` but this was moved to `app/validators/` in the refactor.
We switched from Heroku to Railway in 2024 — update your deploy scripts if you still
have Heroku configuration.
```

### ✅ Good — only current state

```markdown
## Environment Variables

See `.env.example` — all vars validated via `config/env.ts`.

## Architecture

Validators: `app/validators/` · Deploy target: Railway (see `railway.json`)
```

---

## Phase 5 Summary Quality

### ✅ Good — concrete scores, counts all change types, size delta

```text
CLAUDE.md Quality: 54 → 84 | Fixed 4 stale refs | Removed 6 noise items | Compressed 3 prose blocks
Size: 22.4 KB → 6.8 KB | Grade: D → B
Critical thresholds: Commands 14/15 ✅ · Architecture 12/15 ✅ · Conciseness 13/15 ✅
```

### ❌ Bad — no before score, no breakdown, no size

```text
Done. CLAUDE.md has been updated and improved.
```
