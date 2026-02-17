# Compression Guide for CLAUDE.md

Based on [Vercel's AGENTS.md research](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals): 40KB → 8KB (80% reduction) maintained 100% pass rate.

## Size Targets

| Rating | Size | Action |
| --- | --- | --- |
| Optimal | < 8 KB | Maintain |
| Acceptable | 8–15 KB | Monitor, compress if growing |
| Needs work | > 15 KB | Must compress or split to references |

## Compression Techniques

### 1. Tables over Prose

Before (verbose):

```text
When you need to read a Jira issue, use the MCP jira_get_issue tool. Make sure to always
include the fields parameter to avoid token limit issues. For searching, use jira_search
with a JQL query.
```

After (compressed):

```markdown
| Operation | Tool | Key |
| --- | --- | --- |
| Read issue | MCP `jira_get_issue` | Always use `fields` param |
| Search | MCP `jira_search` | JQL query |
```

### 2. Index-Based Pointing

Instead of embedding full docs, point to retrievable files:

```markdown
## API Reference
See `agent_docs/api-services.md` for full endpoint documentation.
Key patterns: REST + JSON, auth via Bearer token, pagination via cursor.
```

### 3. Pipe-Delimited Indexes

For large documentation sets, use compressed indexes matching the Vercel format:

```text
[Next.js Docs Index]|root: ./.next-docs
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for Next.js tasks.
|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx}
|01-app/02-building-your-application/01-routing:{01-defining-routes.mdx,02-pages.mdx,03-layouts-and-templates.mdx}
|01-app/02-building-your-application/04-caching:{01-overview.mdx,02-data-cache.mdx}
```

Generic format for any framework:

```text
[<Framework> Docs Index]|root: ./<docs-dir>
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for <framework> tasks.
|<category>/{<file1>,<file2>,...}
|<category>/<subcategory>:{<file1>,<file2>,...}
```

Key: embed the retrieval directive directly inside the index, not as a separate section.

### 4. One-Liner Patterns

Replace multi-line explanations with single-line rules:

```text
- File naming: `kebab-case.ts` for files, `PascalCase` for components
- Imports: absolute from `@/`, relative only within same directory
- Error handling: Result<T,E> pattern, no try-catch in business logic
```

### 5. Abbreviation Conventions

Use consistent shorthand within CLAUDE.md:

| Long | Short |
| --- | --- |
| For example | e.g. |
| Configuration | config |
| Environment | env |
| Development | dev |
| Production | prod |
| Authentication | auth |
| Documentation | docs |

### 6. Remove What Claude Already Knows (Training Cutoff Awareness)

Claude knows standard framework patterns **up to its training cutoff**. Prioritize content by novelty:

| Priority | Content Type | Action |
| --- | --- | --- |
| High | APIs/patterns released after training cutoff | Keep detailed, add examples |
| High | Custom/internal APIs unique to project | Keep detailed |
| Medium | Non-default framework configurations | Keep as one-liners |
| Low | Standard framework behavior within training data | Remove or compress to minimal |
| Remove | Common language syntax, general best practices | Delete entirely |

**Rule:** If Claude would get it right without docs → remove. If Claude would guess wrong → document thoroughly.

### 7. Novel Content Identification

Determine what the model knows vs. what it needs to be told:

1. **Detect framework version** — check `package.json`, lockfiles, configs
2. **Compare to training cutoff** — Claude's cutoff: May 2025. APIs released after this need full documentation
3. **Categorize content:**

| Category | Action | Example |
| --- | --- | --- |
| Post-cutoff APIs | Document in detail with usage examples | Next.js 16: `connection()`, `'use cache'`, `cacheLife()` |
| Custom/internal APIs | Document thoroughly — model has zero knowledge | Your `createServiceClient()` wrapper |
| Non-default configs | Keep as one-liners | Custom Webpack config, non-standard tsconfig |
| Standard framework behavior | Compress to minimal or remove | Express middleware ordering, React useState |
| Common language syntax | Delete entirely | JavaScript async/await, Python list comprehensions |

**Rule:** If the model would get it right without docs → remove. If it would guess wrong → document thoroughly.

### 8. Noise Reduction

Vercel found that irrelevant context can actively hurt agent performance ("unused skill may introduce noise or distraction"). Apply the same principle to CLAUDE.md:

- **Remove** generic best practices (e.g. "write tests", "use meaningful names")
- **Remove** obvious framework defaults the model already knows
- **Remove** duplicate information that appears in multiple places
- **Remove** verbose explanations when a one-liner suffices
- **Keep only** content that changes agent behavior — if removing a line wouldn't change the agent's output, remove it

### 9. Deduplication

| Situation | Action |
| --- | --- |
| Same info in CLAUDE.md + agent_docs | Keep in agent_docs, add pointer from CLAUDE.md |
| Same info in CLAUDE.md + .claude/rules | Keep in rules, remove from CLAUDE.md |
| Repeated patterns across sections | Extract to single section, reference elsewhere |

## Passive Context Design Principles

From Vercel research — why passive context achieves 100% vs skills at 79%:

1. **No decision point** — info already present, no invocation needed
2. **Consistent availability** — content exists every turn
3. **No ordering issues** — avoids sequencing brittleness

### Key Directive to Include

Add this directive in CLAUDE.md when project uses frameworks:

```text
Prefer retrieval-led reasoning over pre-training-led reasoning for [framework] tasks.
Consult project docs in `agent_docs/` before relying on training knowledge.
```

### Wording Guidelines (Explore-First Framing)

Vercel found that directive wording significantly affects agent behavior:

| Pattern | Effect | Example |
| --- | --- | --- |
| **Explore-first** ✅ | Agent builds project mental model, then consults docs | "Check project structure first, then refer to docs for API details" |
| **Prefer X over Y** ✅ | Agent balances both sources | "Prefer project conventions over standard patterns" |
| **Absolute MUST** ❌ | Agent anchors on docs, misses project context | "You MUST follow the documentation exactly" |
| **Invoke-first** ❌ | Agent reads docs but skips project exploration | "Always read the docs before writing code" |

**Rule:** Use guidance that encourages exploration + retrieval, not absolute directives that cause tunnel vision.

### Structure for Retrieval

Design CLAUDE.md so the agent can find and read specific files rather than needing everything upfront:

```markdown
## Architecture
Tech stack: NestJS + TypeScript + PostgreSQL + Redis
Full architecture docs: `agent_docs/architecture.md`
Key decisions: `agent_docs/adr/` (read specific ADR when relevant)
```

### Framework Docs Index Automation

**Step 1: Check for official tools**

| Framework | Command | What it does |
| --- | --- | --- |
| Next.js | `npx @next/codemod@canary agents-md` | Downloads version-matched docs → `.next-docs/`, injects pipe-delimited index |

**Step 2: If no official tool, generate manually**

1. **Fetch docs** — use context7 MCP (`resolve-library-id` → `query-docs`) to get current framework docs for the project's version
2. **Store locally** — save to `agent_docs/<framework>/` or `.docs/`
3. **Generate index** — create pipe-delimited index pointing to local files:

   ```text
   [<Framework> Docs Index]|root: ./agent_docs/<framework>
   |IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for <framework> tasks.
   |<category>:{<file1>,<file2>}
   ```

4. **Inject into CLAUDE.md** — add the index block, not the full docs
5. **Focus on post-cutoff** — prioritize indexing docs for APIs released after training cutoff

**Step 3: Verify retrievability** — agent should be able to find and read specific docs from the index

## Verification Checklist

After compression, verify:

- [ ] All sections from original still present (or pointed to)
- [ ] No factual information lost
- [ ] File paths and code references still accurate
- [ ] Tables render correctly in markdown
- [ ] Size within target range
- [ ] Spot-check 3 random items for correctness

## Reference Freshness

This guide is based on Vercel's research (published 2025). Re-verify the source article if applying after significant Claude or AGENTS.md ecosystem changes. Key assumptions to validate:

- Passive context still outperforms skills-based approaches
- 8KB compression threshold still holds
- Retrieval-led reasoning remains the recommended directive
