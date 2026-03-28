export const TYPESCRIPT_LENS = `
# TypeScript Review Lens

Inject into reviewer prompts when diff touches: TypeScript files, type definitions, or generic utilities.

\`\`\`text
TYPESCRIPT LENS (active for this review):

HARD RULES (flag unconditionally — no confidence gate):
- \`as any\` — use type guard or Zod/valibot runtime validator
- \`as unknown as T\` — always wrong; use schema.parse() + inferred type
- \`as T\` on external data (API response, JSON.parse) → z.parse() / assertIs*(value)
- \`!\` non-null assertion where \`?.\` or explicit null check exists
- Manual re-implementation of built-ins: \`Partial\`, \`Readonly\`, \`Pick\`, \`Omit\`,
  \`Required\`, \`ReturnType\`, \`Awaited\` → use built-ins; deep variants → type-fest

EXHAUSTIVENESS on discriminated unions:
- \`switch\` on union discriminant without \`default: never\` → future variant falls through silently
  Fix: \`default: { const _: never = x; throw new Error(String(_)); }\`
- \`if/else if\` chain on union type without final \`else\` → same risk

TYPE PREDICATES & ASSERTION FUNCTIONS (TS 5.5+):
- TS 5.5+ infers type predicates on simple boolean-returning guards automatically
  Flag: explicit \`value is T\` on trivially-inferrable predicates (redundant, not wrong)
- Complex / multi-condition guards TS cannot infer → must have explicit \`value is T\`
- Validation boundaries: prefer \`asserts value is T\` over \`as T\`
  Pattern: \`function assertUser(v: unknown): asserts v is User { schema.parse(v); }\`

BRANDED TYPES — flag when 2+ same-base-type params in one function:
- \`(userId: string, productId: string)\` → \`UserId & { __brand: 'UserId' }\`
- Payment/price as bare \`number\` → \`Amount & { __brand: 'Amount' }\`

GENERICS:
- \`T extends object\` → \`T extends Record<string, unknown>\`
- Generic should preserve literal type but doesn't → add \`const\` modifier: \`<const T extends string>\` (5.0+)
- Inference-blocker workarounds (e.g. \`[T][T extends T ? 0 : 0]\`) → use \`NoInfer<T>\` (5.4+)
- \`await fn() as T\` → \`Awaited<ReturnType<typeof fn>>\` or schema.parse()

RESOURCE MANAGEMENT (TS 5.2+):
- DB connections / file handles in try/finally → suggest \`using\` / \`await using\`
  (requires \`Symbol.dispose\` support — check runtime target before flagging)

MODERN TS (4.9–5.9):
- Object literal typed via annotation only → \`satisfies Type\` for literal inference (4.9+)
- \`as const\` without \`satisfies\` → may weaken checking at assignment site
- \`experimentalDecorators: true\` on TS 5.0+ project → migrate to standard decorators

TS 6.0 MIGRATION FLAGS (only when \`tsconfig.json\` is in the PR diff):
- Explicit \`esModuleInterop: false\` → will become default true in 6.0
- Implicit \`allowSyntheticDefaultImports\` → now default true in 6.0

EXISTING (conf ≥75):
- \`any\` params / implicit any from unannotated returns
- Boolean flags for sum types → \`{ status: 'loading' | 'success' | 'error' }\`
- \`@ts-ignore\` / \`@ts-expect-error\` without justification comment
- Exported types leaking implementation internals

THRESHOLD: HARD RULE items → always. All others: conf ≥75.

4-DIMENSION TYPE SCORING (when diff adds or modifies type definitions):

Score each new/modified \`interface\`, \`type\` alias, or \`enum\` in the diff (1-10):

| Dimension          | Score | Question                                               |
|--------------------|-------|--------------------------------------------------------|
| Encapsulation      |       | Can internals change without breaking consumers?       |
| Invariant Express  |       | Does the type make invalid states unrepresentable?     |
| Usefulness         |       | Does it add value over using primitive types?          |
| Enforcement        |       | Does TypeScript actually enforce the constraints?      |

Overall type health = average of 4 dimensions.
Score <5 in ANY dimension = Warning finding citing the specific gap.
Score >=8 average = note as strength (no action required).

Low-score examples:
- Encapsulation=2: \`type Config = { dbHost: string; dbPort: number }\` -- caller knows internals
  Fix: opaque type or branded type to hide structure
- Invariant=1: \`type Status = 'active' | 'inactive' | string\` -- \`string\` widens away the invariant
  Fix: \`type Status = 'active' | 'inactive'\`
- Usefulness=2: \`type Id = number\` without branding -- no safety over bare \`number\`
  Fix: \`type UserId = number & { __brand: 'UserId' }\`
- Enforcement=1: \`interface Response { data: unknown }\` -- TS cannot enforce shape at compile time
  Fix: Zod schema + \`z.infer<typeof ResponseSchema>\`
\`\`\`
`
