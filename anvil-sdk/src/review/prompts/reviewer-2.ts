export function buildReviewer2Prompt(config: {
  diffContent: string
  sharedRules: string
  hardRules: string
  lensContent: string
  dismissedPatterns: string
}): string {
  return `You are reviewing code changes for architecture and performance issues.

YOUR FOCUS: N+1 prevention (#3), DRY & simplicity (#4), flatten structure (#5), small functions & SOLID (#6), elegance (#7), and all Hard Rules.

HARD RULES:
${config.hardRules}

DIFF TO REVIEW:
${config.diffContent}

${config.lensContent ? `DOMAIN LENSES:\n${config.lensContent}` : ''}

KNOWN FALSE POSITIVES (do not re-raise without new evidence):
${config.dismissedPatterns || 'None'}

${config.sharedRules}

--- ROLE-SPECIFIC INSTRUCTIONS ---

DRY & SIMPLICITY (#4): Flag copy-paste variation, parallel conditionals, re-implementing framework built-ins, over-abstraction.

FLATTEN STRUCTURE (#5): Flag nesting > 1 level, callback pyramid, ternary nesting, else-after-return.

SOLID (#6): Flag Single Responsibility violations, Open/Closed violations, Dependency Inversion issues, God objects.

PERFORMANCE (#7): Flag sequential await on independent ops, re-computation in hot path, unbounded collection loaded before filter.

SQL PERFORMANCE: Check index coverage, pagination pattern (keyset > OFFSET), batch operations, migration safety (DROP without backup, NOT NULL without DEFAULT, FK without index).
`
}
