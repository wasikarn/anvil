export const FRONTEND_LENS = `
# Frontend Review Lens

Inject into reviewer prompts when diff touches: React components, Next.js pages, hooks, or UI code.

\`\`\`text
FRONTEND LENS (active for this review):

THRESHOLD: Report at confidence ≥75 unless marked Hard Rule.

RSC / APP ROUTER BOUNDARY (Next.js App Router — flag when \`app/\` dir or \`'use client'\` present):
- \`'use client'\` on a parent that only passes data down → move boundary to leaf; reduces client JS
- Server Component importing a Client Component that re-imports a Server Component → RSC-in-CC
  island breaks; extract inner SC as \`children\` or slot prop
- Default export in \`app/\` without explicit \`'use client'\` but uses hooks/events → will error at runtime
- Missing \`'use server'\` on Server Action handling sensitive ops → treated as client code, security risk
- Server Action without input validation → user-controlled data reaches server unvalidated
- \`cache: 'no-store'\` missing on user-specific \`fetch()\` in Server Component → stale shared cache across users

HYDRATION:
- \`Date.now()\` / \`Math.random()\` / \`new Date()\` in render path (outside \`useEffect\`) → hydration mismatch
- Browser-only API (\`window\`, \`document\`, \`localStorage\`) accessed outside \`useEffect\` without
  \`typeof window !== 'undefined'\` guard → SSR crash
- Dynamic content (personalization, timestamps) rendered in SSR without deferred mount pattern
  Fix: \`const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);\`
- \`suppressHydrationWarning\` used without comment explaining why → masks real hydration bugs

STREAMING & SUSPENSE:
- Async Server Component without \`<Suspense fallback={...}>\` → entire route blocks on slowest fetch
- Multiple independent data fetches in one component → split across components with Suspense boundaries
  (parallel streams vs waterfall)
- Missing \`loading.tsx\` for route segments with async data → no user feedback during navigation
- \`<Suspense>\` wrapping a Client Component that fetches with \`useEffect\` → Suspense only works with
  \`use()\` hook or async Server Component; \`useEffect\` fetch not suspended

REACT PATTERNS:
- Waterfall requests: sequential \`await\` in Server Component where \`Promise.all\` enables parallelism
- Barrel imports: \`import { X } from 'lib'\` pulling entire index → prefer direct path imports
- Missing error boundaries: async operations without \`error.tsx\` (App Router) or \`<ErrorBoundary>\`
- Hook violations: hooks inside conditions/loops, missing dependency arrays in \`useEffect\`/\`useCallback\`
- Prop drilling: data passed through 3+ component levels → consider context or composition
- \`setState\` in \`useEffect\` with missing/unstable deps → infinite re-render or stale closure
- Missing \`key\` props: lists without stable keys, index-as-key on reorderable lists

ACCESSIBILITY:
- Interactive elements (\`div onClick\`, \`span onClick\`) missing \`role\`, \`tabIndex\`, keyboard handler
- Images missing \`alt\` attribute or using non-descriptive alt text (e.g., \`alt="image"\`)
- Color as sole information carrier (no text/icon alternative)
- Form inputs without associated \`<label>\` or \`aria-label\`
\`\`\`
`
