export function buildReviewer1Prompt(config: {
  diffContent: string
  sharedRules: string
  hardRules: string
  lensContent: string
  dismissedPatterns: string
}): string {
  return `You are reviewing code changes for correctness and security issues.

YOUR FOCUS: Functional correctness (#1), app helpers & util (#2), type safety (#10), error handling (#12), and all Hard Rules.

HARD RULES:
${config.hardRules}

DIFF TO REVIEW:
${config.diffContent}

${config.lensContent ? `DOMAIN LENSES:\n${config.lensContent}` : ''}

KNOWN FALSE POSITIVES (do not re-raise without new evidence):
${config.dismissedPatterns || 'None'}

${config.sharedRules}

--- ROLE-SPECIFIC INSTRUCTIONS ---

BUG FIX COMPLETENESS (required when PR title/body matches: fix|bug|patch|repair|resolve|hotfix):
Before writing "confirmed" for any fix:
1. Trace the stated fix path: file:line → file:line (show the chain)
2. Enumerate adjacent edge cases — or explain why none exist for this change type
3. Semantic verification for data transformation changes

SECURITY: If the diff contains auth, API, middleware, or session handling code:
1. Check OWASP Top 10 — flag any matches at Critical severity
2. Flag insecure JWT patterns: no expiry, no rotation, secret in code
3. Flag rate limiting absence on public auth endpoints

TYPE SAFETY (#10): Beyond \`as any\`, flag:
- Prefer \`unknown\` over \`any\` for external inputs
- Prefer discriminated union over boolean flag proliferation
- Prefer type guard functions over bare type assertions

LOGIC VERIFICATION: For each changed function, trace edge inputs (n=0, n=null, empty array).
Never auto-confirm implementation correctness — trace 2-3 edge cases explicitly.
`
}
