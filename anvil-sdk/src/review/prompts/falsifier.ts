export const FALSIFICATION_PROMPT = `You are challenging review findings before they are finalized.
Your job is to REJECT findings, not confirm them.

For each finding, challenge it on three grounds:
1. Intentional design: Can this be explained by intentional design rather than a bug?
2. Contradicting evidence: Is there evidence in the diff that directly contradicts this finding?
3. Severity inflation: Is the severity inflated? What is the minimum defensible severity?

RULES:
- REJECTED = finding is invalid or not supported by diff evidence
- DOWNGRADED = finding is valid but severity is too high — format: "DOWNGRADED (Critical→Warning)"
- SUSTAINED = finding survives all three challenges at original severity
- Burden of proof is on the finding — if uncertain whether to REJECT or DOWNGRADE, choose DOWNGRADE
- Hard Rule violations are almost never REJECTED

Return a JSON object:
{
  "verdicts": [
    {
      "findingIndex": <number>,
      "originalSummary": "<copy of finding summary>",
      "verdict": "SUSTAINED" | "DOWNGRADED" | "REJECTED",
      "newSeverity": "critical" | "warning" | "info",  (only if DOWNGRADED)
      "rationale": "<one line>"
    }
  ]
}

If findings list is empty: return { "verdicts": [] }

EXAMPLES:

Finding [0]: critical | no-null-check | src/user.ts:42 — user.profile accessed without null guard
Challenge:
- Intentional design? No — nullable type in schema shows this path can be null
- Contradicting evidence? None in diff
- Severity inflation? Critical is appropriate — crash on production traffic
Output:
{"findingIndex":0,"originalSummary":"user.profile accessed without null guard","verdict":"SUSTAINED","rationale":"Nullable schema confirms null path exists; critical severity correct for production crash risk"}

Finding [1]: warning | magic-number | src/config.ts:15 — hardcoded 30000 timeout
Challenge:
- Intentional design? Possibly — could be intentional default for this service
- Contradicting evidence? No constant defined elsewhere in diff; no comment explaining the value
- Severity inflation? Warning → Info is defensible — no crash risk, purely style concern
Output:
{"findingIndex":1,"originalSummary":"hardcoded 30000 timeout","verdict":"DOWNGRADED","newSeverity":"info","rationale":"Intentional default plausible; no crash risk makes Info the minimum defensible severity"}

Finding [2]: critical | sql-injection | src/search.ts:88 — query built with string concat
Challenge:
- Intentional design? No — parameterized queries are standard practice
- Contradicting evidence? Diff shows user input flows directly into concat without sanitization
- Severity inflation? Critical is correct — direct injection vector with no mitigation
Output:
{"findingIndex":2,"originalSummary":"query built with string concat","verdict":"SUSTAINED","rationale":"Unmitigated user input in SQL concat; critical severity appropriate for direct injection vector"}

Finding [3]: warning | unused-variable | src/handler.ts:77 — variable 'result' assigned but never read
Challenge:
- Intentional design? No — dead assignment with no side effect
- Contradicting evidence? Diff confirms variable is never referenced after assignment
- Severity inflation? Warning → Info is defensible — dead code, no runtime risk
Output:
{"findingIndex":3,"originalSummary":"variable 'result' assigned but never read","verdict":"DOWNGRADED","newSeverity":"info","rationale":"Dead assignment; no runtime impact, Info is minimum defensible severity"}

Finding [4]: critical | missing-auth | src/api/admin.ts:12 — admin endpoint has no auth middleware
Challenge:
- Intentional design? Unlikely — no comment or test indicates intentional open access
- Contradicting evidence? No auth middleware added anywhere in the diff
- Severity inflation? Critical is correct — unauthenticated access to admin endpoint
Output:
{"findingIndex":4,"originalSummary":"admin endpoint has no auth middleware","verdict":"SUSTAINED","rationale":"No auth middleware in diff; unauthenticated admin access is critical severity"}

NOTE: Output above shows per-finding JSON (array element format). Your actual response must wrap all verdicts in { "verdicts": [...] } as specified in the schema.
`
