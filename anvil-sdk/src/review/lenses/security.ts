export const SECURITY_LENS = `
# Security Review Lens

Inject into reviewer prompts when diff touches: auth, API endpoints, user input, DB queries, file uploads, credentials/tokens.

\`\`\`text
SECURITY LENS (active for this review):

THRESHOLD: conf ≥70 (lower than default — security FPs acceptable).
Hard Rule violations always reported regardless of confidence.

DATA FLOW TRACING (highest value — flag when uncertain):
For any param flowing into DB query, file op, shell command, or HTML output:
1. Trace backward from sink to source: is any part user-controlled?
2. Verify sanitization at each trust boundary crossing (controller → service → repo)
3. If trace is incomplete (crosses file boundary not in diff) → flag as Warning:
   "Verify input sanitized before reaching {sink}"
- SQL/ORM: string concat in WHERE → parameterized query / ORM placeholder
- Shell: user value in exec/spawn → allowlist validation, never string concat
- HTML output: unescaped user value → context-appropriate encoding
- File path: \`../\` traversal → path.resolve() + startsWith(allowedBase) check

SECRET DETECTION (flag at conf ≥60):
- High-entropy string assigned to variable (20+ random chars)
- Connection string with embedded password: \`postgresql://user:pass@host\`
- PEM marker: \`-----BEGIN PRIVATE KEY-----\` / \`-----BEGIN RSA PRIVATE KEY-----\`
- Hardcoded JWT secret: \`jwt.sign(payload, "mysecret")\`
- Env var logged: \`logger.info({ env: process.env })\` / spread of process.env

BUSINESS LOGIC (highest AI value — SAST tools cannot detect these):
- State transition bypass: can step N be called without completing step N-1?
- Race condition: concurrent requests to payment/inventory/points without atomic guard
- Workflow bypass: restricted route reachable by manipulating params/headers?
- Resource quota: endpoint accepting collection input without size cap (DoS risk)
- Re-authentication: sensitive ops (password change, payment, deletion) without
  confirming current credentials

OWASP TOP 10 (conf ≥70):
- A01 Access Control: missing auth guard on route, IDOR (param ID not verified against owner)
- A02 Crypto: MD5/SHA1/DES/RC4, timing-unsafe comparison (\`===\` on secrets →
  \`crypto.timingSafeEqual\`), HTTP not HTTPS
- A03 Injection: user input in query/command without parameterization
- A05 Misconfiguration: CORS \`*\` on credentialed routes, debug endpoints in production
- A07 Auth Failures: no rate limit on auth endpoint, weak session token entropy (<128 bits)
- A08 Integrity: missing CSRF on state-changing POST, insecure deserialization
\`\`\`
`
