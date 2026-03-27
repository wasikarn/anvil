import type { DiffBucket, FileDiff, ReviewRole } from '../../types.js'

/**
 * Returns the set of roles a file belongs to, applying domain mapping rules in order.
 * Overlap policy: a file matching multiple domains is included in ALL matching buckets.
 */
function getRolesForFile(file: FileDiff): Set<ReviewRole> {
  const p = file.path
  const roles = new Set<ReviewRole>()

  // Test files → dx
  if (/\.(test|spec)\.(ts|tsx)$/.test(p)) {
    roles.add('dx')
  }

  // Frontend files → dx
  if (
    /\.(tsx|jsx)$/.test(p) ||
    p.includes('components/') ||
    p.includes('pages/') ||
    p.includes('app/')
  ) {
    roles.add('dx')
  }

  // SQL / migrations → architecture
  if (/\.sql$/.test(p) || p.includes('migrations/')) {
    roles.add('architecture')
  }

  // Config files → architecture (excluding package.json / tsconfig)
  if (
    p.includes('config/') ||
    p.includes('.env') ||
    /\.(yaml|yml)$/.test(p) ||
    (/\.json$/.test(p) && !/package\.json$/.test(p) && !/tsconfig/.test(p))
  ) {
    roles.add('architecture')
  }

  // Auth / middleware / guard / permission → correctness
  if (
    p.includes('auth/') ||
    p.includes('middleware/') ||
    p.includes('guard/') ||
    p.includes('permission/')
  ) {
    roles.add('correctness')
  }

  // Service / controller / repository / handler → correctness + architecture
  if (
    p.includes('service/') ||
    p.includes('controller/') ||
    p.includes('repository/') ||
    p.includes('handler/')
  ) {
    roles.add('correctness')
    roles.add('architecture')
  }

  // Model / schema (not test) → architecture + correctness
  if (
    (p.includes('model/') || p.includes('schema/')) &&
    !(/\.(test|spec)\.(ts|tsx)$/.test(p))
  ) {
    roles.add('architecture')
    roles.add('correctness')
  }

  // Default: any .ts/.js not yet assigned → correctness
  if (roles.size === 0 && /\.(ts|js)$/.test(p)) {
    roles.add('correctness')
  }

  return roles
}

/**
 * Maps file diffs to reviewer domain buckets.
 * Files matching multiple domains go into ALL matching buckets (overlap policy).
 * lenses field is populated empty — filled later by orchestrator.
 */
export function mapToDomains(files: FileDiff[]): DiffBucket[] {
  const buckets: Record<ReviewRole, FileDiff[]> = {
    correctness: [],
    architecture: [],
    dx: [],
  }

  for (const file of files) {
    const roles = getRolesForFile(file)
    for (const role of roles) {
      buckets[role].push(file)
    }
  }

  const roles: ReviewRole[] = ['correctness', 'architecture', 'dx']
  return roles.map(role => ({
    role,
    files: buckets[role],
    lenses: [],
    totalLines: buckets[role].reduce((sum, f) => sum + f.linesChanged, 0),
  }))
}

// Test with: npx tsx src/review/domain-mapper.ts (manual)
