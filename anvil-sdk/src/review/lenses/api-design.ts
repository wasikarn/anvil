export const API_DESIGN_LENS = `
# API Design Review Lens

Inject into reviewer prompts when diff touches: route handlers, controllers, API endpoints, REST routes, or GraphQL resolvers.

\`\`\`text
API DESIGN LENS (active for this review):

THRESHOLD: Report at confidence ≥75 unless marked Hard Rule.

STATUS CODE CORRECTNESS (Hard Rule — flag unconditionally):
- \`200 OK\` returned for resource creation → must be \`201 Created\` with \`Location\` header
- \`200 OK\` returned for errors (error in body but 200 status) → breaks HTTP semantics
- \`500\` returned for client errors (invalid input, auth failure) → must be 4xx
- \`404\` used for authorization failures where resource exists → use \`403 Forbidden\` (avoids leaking existence)
- DELETE returning body with \`200\` instead of \`204 No Content\` (when body is empty)

IDEMPOTENCY:
- PUT/PATCH/DELETE not idempotent: same request produces different result on repeat
  Check: does the handler have side effects (email send, payment charge) not guarded by idempotency key?
- POST endpoint for non-idempotent op (payment, order submit) without idempotency key support
  Pattern: \`Idempotency-Key\` header; store result keyed to hash; return cached result on repeat
- \`POST /resource\` that creates duplicate on double-submit → add unique constraint or check-then-insert

BACKWARD COMPATIBILITY (Hard Rule — never silently break callers):
- Removing a response field that existing callers may read
- Renaming a response field without keeping the old name as deprecated alias
- Changing a field type (string → number, nullable → required)
- Changing HTTP method on existing route (GET → POST)
- Adding a new required request parameter to an existing endpoint
  Fix: default the param or make it optional; bump major version if breaking

RESPONSE ENVELOPE CONSISTENCY:
- Inconsistent response shape across endpoints in same API (some wrap in \`{ data: ... }\`, some don't)
- Error response missing \`message\` and \`code\` fields → not machine-readable for client error handling
  Pattern: \`{ error: { code: 'USER_NOT_FOUND', message: '...', details?: [...] } }\`
- Collection endpoint returning raw array instead of paginated envelope
  Pattern: \`{ data: [...], meta: { total, page, perPage, hasNext } }\`
- Timestamps missing timezone (bare \`"2024-01-01"\` instead of ISO 8601 with \`Z\`)

PAGINATION:
- OFFSET pagination on large table → cursor/keyset pagination
  (OFFSET performance degrades as page number grows; cursor is O(1) with index)
- No max page size enforced → \`?limit=999999\` triggers unbounded query
- Inconsistent pagination params across endpoints (\`page\`/\`size\` vs \`offset\`/\`limit\` vs \`cursor\`)

VALIDATION & INPUT:
- No input schema validation on request body → relies on DB constraints for error reporting
  Fix: validate at controller boundary (Zod, Joi, AJV) before reaching service layer
- Validation error returns \`500\` instead of \`422 Unprocessable Entity\`
- Array input without max-size guard → DoS via large payload

VERSIONING:
- Breaking change deployed without version bump (\`/v1/\` → \`/v2/\` or header versioning)
- New endpoint added without documenting in OpenAPI/Swagger if project uses spec
\`\`\`
`
