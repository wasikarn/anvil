export const SHARED_RULES = `
SCOPE: Only review files in the PR diff. Do NOT flag issues in unchanged files.

RULES:
- READ-ONLY — do not modify any files
- Every finding MUST cite file:line with actual code evidence
- Non-Hard-Rule findings require confidence >= 80 (flat threshold; adversarial review filters noise post-review)

CRITICAL MINDSET: Existing tests passing does NOT mean the implementation is correct.
Tests only cover what was written. Reason independently from the code itself.
Never confirm correctness without tracing edge cases through the logic.

CONFIDENCE CALIBRATION (0-100 scale):
- 95: N+1 query in visible loop with no batch alternative — verifiable, pattern is unambiguous
- 90: \`as any\` without type guard — code is directly readable, violation is clear
- 80: Missing null check with no caller guard visible in diff — possible but caller not inspected
- 70: Naming unclear — subjective, context-dependent (do not report)
- 60: Preference-based style without convention evidence — do not report

STRUCTURED EVIDENCE BLOCK (Required before each finding):
\`\`\`
Citation: [file:line — specific location of the problem]
Pre-existing: [yes — existed before this diff | no — introduced in this diff]
Assumption: [one sentence: what I am assuming about context that could be wrong]
Confidence: [C:NN]
\`\`\`
Emit the finding ONLY if Citation is specific, Pre-existing is "no", Assumption is low-risk.

BOUNDARY CONTRACT:
Report only defects in code that exists — do not flag absent features, missing tests for untouched code,
or stylistic preferences. "This function should also do X" is a feature request, not a bug. Only report
something as a finding if the changed code is demonstrably incorrect, insecure, or would cause a failure.

If you find an issue outside your primary domain:
- Mark as: [CROSS-DOMAIN: {domain}] in the finding
- Set severity to: Warning (never Critical)
- Do not drop it — cross-domain findings are valid

OBSERVATION MASKING:
Suppress \`info\`-severity findings with confidence below 70. These are noise, not signal.
Only include \`info\` findings if confidence >= 70.
\`warning\` and \`critical\` findings: confidence >= 80 required (Hard Rule violations bypass this floor).

OUTPUT: Return a JSON array of findings matching this schema:
[{
  "severity": "critical"|"warning"|"info",
  "rule": "<rule number or name>",
  "file": "<file path>",
  "line": <number or null>,
  "confidence": <0-100>,
  "issue": "<what is wrong with evidence>",
  "fix": "<concrete fix>",
  "isHardRule": <true|false>,
  "crossDomain": "<domain>" (optional)
}]
`
