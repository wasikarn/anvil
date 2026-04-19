---
name: df-docs
description: "Generate documentation for code — API endpoint docs, README sections, or inline JSDoc/TSDoc comments. Modes: --api (document REST API endpoints from route/controller files), --readme (generate or update README sections for new or changed features), --inline (add JSDoc/TSDoc to exported functions and classes lacking documentation). Reads existing docs to match project style before generating. Triggers: generate docs, document API, add JSDoc, update README, write documentation, TSDoc, API reference."
argument-hint: "[--api|--readme|--inline] [file-or-directory?]"
effort: high
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Generate Docs

Generate documentation for the codebase. Default (no args): analyze codebase and recommend the most useful mode.

Parse `$ARGUMENTS` to determine mode and optional target path:

- `--api` → generate REST API endpoint documentation
- `--readme` → generate or update README sections
- `--inline` → add JSDoc/TSDoc to undocumented exports
- No args → auto-detect mode (see Default section)

## Default (no args)

Analyze the codebase and suggest the most useful documentation mode:

1. Check for undocumented exported functions: `grep -r "^export" --include="*.ts" | grep -v "\.spec\." | head -20`
2. Check for route files: `find . -name "*.route*" -o -name "*.controller*" | grep -v node_modules | head -10`
3. Check README completeness: read `README.md` first 50 lines
4. Report findings and ask: "Which mode would you like to run? --api, --readme, or --inline"

## Mode: --api

Document REST API endpoints from route and controller files.

**Step 1 — Discover route files:**

```bash
find . \( -name "*.route.ts" -o -name "*.router.ts" -o -name "*routes*.ts" -o -name "*.controller.ts" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" | sort
```

Also check framework-specific patterns:

- Express: `router.get/post/put/delete/patch`
- AdonisJS: `Route.get/post/put/delete`, `router.group`
- Fastify: `fastify.get/post/register`
- NestJS: `@Controller`, `@Get`, `@Post`

**Step 2 — Read existing API docs** (if any):

- `docs/api.md`, `API.md`, `openapi.yaml`, `swagger.json`
- Match the existing format and style

**Step 3 — Extract and document each endpoint:**

For each route, capture:

- Method + path
- Description (infer from controller logic)
- Auth requirement (look for middleware/guards)
- Request body/params/query schema
- Response shape and status codes
- Error responses

**Step 4 — Write output:**

Write to `docs/api.md` (create if missing, update if exists). Each endpoint section should include: heading with method and path, description, auth requirement, request body table (Field/Type/Required/Description), response shape and status codes, and error cases.

Example output structure for a single endpoint:

```text
## POST /auth/login
Authenticate user and return access token.
**Auth:** Public
**Request Body:** Field | Type | Required | Description table
**Response 200:** { "token": "string", "expiresAt": "ISO8601" }
**Errors:** 401 Invalid credentials · 429 Rate limit exceeded
```

## Mode: --readme

Generate or update README sections for new or changed code.

**Step 1 — Read existing README:**

Read `README.md` completely. Note: existing sections, style, tone, heading levels.

**Step 2 — Identify gaps:**

```bash
git diff --name-only origin/main...HEAD 2>/dev/null | head -30
```

For each changed file, check if README has a corresponding section.
Also check for:

- New skills/commands with no documentation
- New configuration options not mentioned
- Changed CLI flags or env vars

**Step 3 — Generate new sections:**

Write sections that match the existing README style:

- Same heading depth
- Same code block language tags
- Same table format if used
- Same tone (formal/informal)

**Step 4 — Apply edits:**

Use Edit to insert new sections in the appropriate location in `README.md`.
Do not remove or modify existing sections. Only add or update gaps.

After editing: confirm what sections were added/updated.

## Mode: --inline

Add JSDoc/TSDoc to exported functions and classes that lack documentation.

**Step 1 — Find undocumented exports:**

```bash
# Find exported functions/classes without a JSDoc comment above them
grep -rn "^export\s\+\(function\|class\|const\|async\)" \
  --include="*.ts" --include="*.tsx" \
  -l . 2>/dev/null | grep -v "\.spec\." | grep -v node_modules
```

For each file, read it and identify exported symbols without `/** ... */` blocks immediately above.

**Step 2 — Read existing documented functions:**

Sample 2–3 already-documented functions in the same file/project to match:

- JSDoc vs TSDoc style
- `@param` / `@returns` vs `@param {}` with types
- Description verbosity (one-line vs multi-line)
- Use of `@throws`, `@example`, `@since`

**Step 3 — Generate and apply documentation:**

For each undocumented exported symbol:

1. Read the function body to understand its purpose
2. Infer param types from TypeScript signatures (avoid redundant type annotations in JSDoc if TS types exist)
3. Write a concise description + `@param` + `@returns` (+ `@throws` if applicable)
4. Apply with Edit — insert the JSDoc block immediately above the export

**Step 4 — Report:**

List all files modified and count of symbols documented. Example:

```text
Documented 12 exports across 4 files:
  src/services/auth.service.ts — 3 functions
  src/utils/crypto.ts — 5 functions
  src/models/user.model.ts — 4 methods
```

## Documentation Templates

For format examples and templates, see:

- **[references/templates.md](references/templates.md)** — API endpoint format, README section templates, JSDoc/TSDoc patterns

## Feedback Loop

After writing or editing documentation, verify the output is coherent:

- For `--api`: check that all route files found have corresponding entries in `docs/api.md`
- For `--readme`: re-read the modified README section to confirm it reads naturally
- For `--inline`: spot-check 2–3 generated JSDoc blocks for accuracy

If any section looks wrong or incomplete, revise before finishing.
