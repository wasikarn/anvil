import { describe, expect, it } from 'vitest'
import { mapToDomains } from './domain-mapper.js'
import type { FileDiff } from '../types.js'

function makeFile(path: string): FileDiff {
  return { path, hunks: '', language: 'ts', diffLineCount: 10 }
}

function bucketsFor(paths: string[]): Record<string, string[]> {
  const result = mapToDomains(paths.map(makeFile))
  return Object.fromEntries(result.filter(b => b.files.length > 0).map(b => [b.role, b.files.map(f => f.path)]))
}

describe('mapToDomains', () => {
  it('test files → dx', () => {
    const buckets = bucketsFor(['src/foo.test.ts', 'src/bar.spec.ts'])
    expect(buckets['dx']).toEqual(['src/foo.test.ts', 'src/bar.spec.ts'])
    expect(buckets['correctness']).toBeUndefined()
  })

  it('TSX/component files → dx', () => {
    const buckets = bucketsFor(['src/components/Button.tsx', 'pages/index.tsx'])
    expect(buckets['dx']).toBeDefined()
    expect(buckets['correctness']).toBeUndefined()
  })

  it('migration files → architecture', () => {
    const buckets = bucketsFor(['database/migrations/001_create_users.ts'])
    expect(buckets['architecture']).toBeDefined()
    expect(buckets['correctness']).toBeUndefined()
  })

  it('SQL files → architecture', () => {
    const buckets = bucketsFor(['db/schema.sql'])
    expect(buckets['architecture']).toBeDefined()
  })

  it('auth files → correctness', () => {
    const buckets = bucketsFor(['src/auth/middleware.ts'])
    expect(buckets['correctness']).toBeDefined()
    expect(buckets['architecture']).toBeUndefined()
  })

  it('service files → correctness + architecture (overlap)', () => {
    const buckets = bucketsFor(['src/service/UserService.ts'])
    expect(buckets['correctness']).toBeDefined()
    expect(buckets['architecture']).toBeDefined()
  })

  it('controller files → correctness + architecture', () => {
    const buckets = bucketsFor(['src/controller/UserController.ts'])
    expect(buckets['correctness']).toBeDefined()
    expect(buckets['architecture']).toBeDefined()
  })

  it('model files → architecture + correctness', () => {
    const buckets = bucketsFor(['src/model/User.ts'])
    expect(buckets['correctness']).toBeDefined()
    expect(buckets['architecture']).toBeDefined()
  })

  it('unrecognized file → correctness (default)', () => {
    const buckets = bucketsFor(['src/utils/helpers.ts'])
    expect(buckets['correctness']).toBeDefined()
    expect(buckets['architecture']).toBeUndefined()
    expect(buckets['dx']).toBeUndefined()
  })

  it('Next.js App Router API route (.ts) → correctness (not dx)', () => {
    const buckets = bucketsFor(['app/api/users/route.ts'])
    expect(buckets['correctness']).toBeDefined()
    expect(buckets['dx']).toBeUndefined()
  })

  it('Next.js App Router page (.tsx) → dx via extension', () => {
    const buckets = bucketsFor(['app/products/page.tsx'])
    expect(buckets['dx']).toBeDefined()
  })

  it('config YAML → architecture', () => {
    const buckets = bucketsFor(['config/app.yaml'])
    expect(buckets['architecture']).toBeDefined()
  })

  it('package.json is NOT classified as architecture', () => {
    const buckets = bucketsFor(['package.json'])
    expect(buckets['architecture']).toBeUndefined()
    expect(buckets['correctness']).toBeDefined()
  })

  it('totalLines is sum of diffLineCount in bucket', () => {
    const files = [makeFile('src/a.ts'), makeFile('src/b.ts')]
    files[0]!.diffLineCount = 20
    files[1]!.diffLineCount = 15
    const buckets = mapToDomains(files)
    const correctness = buckets.find(b => b.role === 'correctness')
    expect(correctness?.totalLines).toBe(35)
  })

  it('always returns exactly 3 buckets (correctness/architecture/dx)', () => {
    const result = mapToDomains([makeFile('src/foo.ts')])
    expect(result).toHaveLength(3)
    const roles = result.map(b => b.role)
    expect(roles).toContain('correctness')
    expect(roles).toContain('architecture')
    expect(roles).toContain('dx')
  })
})
