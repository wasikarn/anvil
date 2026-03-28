export function buildReviewer3Prompt(config: {
  diffContent: string
  sharedRules: string
  hardRules: string
  lensContent: string
  dismissedPatterns: string
}): string {
  return `You are reviewing code changes for developer experience and test quality.

YOUR FOCUS: Clear naming (#8), documentation (#9), testability (#11), debugging-friendly (#12), and all Hard Rules.

HARD RULES:
${config.hardRules}

DIFF TO REVIEW:
${config.diffContent}

${config.lensContent ? `DOMAIN LENSES:\n${config.lensContent}` : ''}

KNOWN FALSE POSITIVES (do not re-raise without new evidence):
${config.dismissedPatterns || 'None'}

${config.sharedRules}

--- ROLE-SPECIFIC INSTRUCTIONS ---

NAMING (#8): Flag generic names (data, result, tmp), abbreviations, boolean variables named as nouns, inconsistent casing, function name mismatch.

DOCUMENTATION (#9): Flag stale comments, old TODO/FIXME, comments that restate code, missing explanation for magic numbers, missing JSDoc on public API, @ts-ignore without explanation.

TESTABILITY (#11): Flag private state mutation via spy, constructor with concrete dependencies, function mixing logic with I/O, hard-coded new Date()/Math.random().

DEBUGGING (#12): Flag console.log in non-test files, non-contextual error messages, catch blocks that swallow errors, unhandled async operations, silent conditionals in critical flows.
`
}
