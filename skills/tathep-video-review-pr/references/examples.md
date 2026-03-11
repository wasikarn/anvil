# Code Examples — tathep-video-processing

Examples for rules that are project-specific or counter-intuitive.

---

## #1 Functional Correctness

```ts
// ✅ State machine transition — valid path only
function transitionState(job: VideoJob, event: 'start' | 'complete' | 'fail'): VideoProcessingState {
  if (job.state === 'pending' && event === 'start') return 'processing'
  if (job.state === 'processing' && event === 'complete') return 'completed'
  if (job.state === 'processing' && event === 'fail') return 'failed'
  throw VideoProcessingError.permanent(`Invalid transition: ${job.state} → ${event}`, job.id)
}

// ❌ No state validation — allows invalid transitions
function transitionState(job: VideoJob, event: string): string {
  return event === 'complete' ? 'completed' : 'failed'  // skips pending → processing!
}
```

```ts
// ✅ Inbox pattern for idempotency
const existing = await inboxRepo.findByMessageId(event.messageId)
if (existing) {
  logger.info('Duplicate event, skipping', { messageId: event.messageId })
  return
}
await inboxRepo.save({ messageId: event.messageId, processedAt: new Date() })
await processVideo(event)

// ❌ No dedup — processes same event twice
await processVideo(event)  // duplicate events cause double processing!
```

---

## #2 Error Handling & Patterns

```ts
// ✅ rethrowOrWrapError for Promise chains
import { rethrowOrWrapError } from '@/utils/error-handling'

await uploadToS3(videoBuffer, key).catch((error: unknown): never =>
  rethrowOrWrapError(error, ErrorCodes.S3_UPLOAD_FAILED, 'Upload failed', { videoId, key })
)

// ❌ Raw try-catch — loses error context
try {
  await uploadToS3(videoBuffer, key)
} catch (e) {
  throw new Error('Upload failed')  // original error lost, no error code
}
```

```ts
// ✅ createErrorHandler for reusable error handling
import { createErrorHandler } from '@/utils/error-handling'

const handleUploadError = createErrorHandler(
  ErrorCodes.S3_UPLOAD_FAILED,
  'Upload failed',
  { videoId }
)
await uploadToS3(buffer, key).catch(handleUploadError)

// ❌ Repeated inline error handling
await upload1().catch(e => { throw new Error('failed') })
await upload2().catch(e => { throw new Error('failed') })  // duplicated!
```

```ts
// ✅ Domain exception — transient vs permanent
throw VideoProcessingError.transient('S3 temporarily unavailable', videoId, { retryAfter: 30 })
throw VideoProcessingError.permanent('Unsupported video codec', videoId, { codec: 'vp8' })

// ❌ Generic Error — no classification, no retry decision
throw new Error('Video processing failed')
```

```ts
// ✅ Structured logging via LoggerFactory
import { LoggerFactory } from '@/infrastructure/telemetry/LoggerFactory'

const logger = LoggerFactory.getLogger({ context: 'ProcessVideoHandler' })
logger.info('Processing started', { videoId, aspectRatio })
logger.error('Processing failed', { videoId, error: err.message, errorCode: err.code })

// ❌ console.log — unstructured, no context, no correlation ID
console.log('Processing started')
console.error('Error:', err)
```

---

## #3 N+1 Prevention

```ts
// ✅ Batch insert — 1 query total
await db.insert(jobOutputs).values(
  aspectRatios.map((ratio) => ({
    jobId,
    aspectRatio: ratio,
    status: 'pending',
  }))
)

// ❌ N+1 — 1 insert per aspect ratio
for (const ratio of aspectRatios) {
  await db.insert(jobOutputs).values({ jobId, aspectRatio: ratio, status: 'pending' })
}
```

```ts
// ✅ SQL aggregate — counted at DB level
const count = await db
  .select({ count: sql<number>`count(*)` })
  .from(videoJobs)
  .where(eq(videoJobs.state, 'processing'))

// ❌ In-memory counting — fetches all rows
const jobs = await db.select().from(videoJobs).where(eq(videoJobs.state, 'processing'))
const count = jobs.length  // loaded N rows just to count!
```

---

## #4 DRY & Simplicity

```ts
// ✅ Extract repeated retry logic
const RETRY_DELAYS = [30_000, 60_000, 120_000] as const

function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
}

// ❌ Magic numbers repeated across handlers
await queue.add('retry', data, { delay: attempt === 0 ? 30000 : attempt === 1 ? 60000 : 120000 })
// In another handler — exact same logic:
const delay = attempt === 0 ? 30000 : attempt === 1 ? 60000 : 120000
```

---

## #5 Flatten Structure

```ts
// ✅ Early returns — max 1 level, use continue for filtering
for (const job of jobs) {
  if (job.state !== 'pending') continue
  if (job.isExpired()) continue
  await processJob(job)
}

// ❌ Nested conditions inside loop
for (const job of jobs) {
  if (job.state === 'pending') {
    if (!job.isExpired()) {
      await processJob(job)
    }
  }
}
```

```ts
// ✅ Guard clauses — flat function body
function validateVideoInput(input: VideoInput): void {
  if (!input.url) throw VideoProcessingError.permanent('Missing URL', input.id)
  if (!SUPPORTED_FORMATS.includes(input.format)) throw VideoProcessingError.permanent('Unsupported format', input.id)
  if (input.duration > MAX_DURATION) throw VideoProcessingError.permanent('Duration exceeds limit', input.id)
}

// ❌ Nested validation
function validateVideoInput(input: VideoInput): void {
  if (input.url) {
    if (SUPPORTED_FORMATS.includes(input.format)) {
      if (input.duration <= MAX_DURATION) {
        return  // valid
      } else {
        throw VideoProcessingError.permanent('Duration exceeds limit', input.id)
      }
    } else {
      throw VideoProcessingError.permanent('Unsupported format', input.id)
    }
  } else {
    throw VideoProcessingError.permanent('Missing URL', input.id)
  }
}
```

### Lookup table for multi-branch conditions

❌ Bad:

```typescript
function getStatusColor(status: string): string {
  if (status === 'active') {
    return 'green'
  } else if (status === 'pending') {
    return 'yellow'
  } else if (status === 'error') {
    return 'red'
  } else if (status === 'cancelled') {
    return 'gray'
  } else {
    return 'black'
  }
}
```

✅ Good:

```typescript
const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  pending: 'yellow',
  error: 'red',
  cancelled: 'gray',
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'black'
}
```

### Extract complex conditional blocks

❌ Bad:

```typescript
async function processVideoJob(job: VideoJob) {
  if (job.state === 'pending') {
    if (job.input.isValid()) {
      if (!job.isExpired()) {
        // ... processing logic
      }
    }
  }
}
```

✅ Good:

```typescript
async function processVideoJob(job: VideoJob) {
  if (job.state !== 'pending') return
  if (!job.input.isValid()) throw VideoProcessingError.permanent('Invalid input', job.id)
  if (job.isExpired()) throw VideoProcessingError.permanent('Job expired', job.id)

  await executeVideoProcessing(job)
}
```

---

## #6 Small Function & SOLID

```ts
// ✅ Domain entity — business rules only, no external deps
// src/domain/entities/VideoJob.ts
export class VideoJob {
  canRetry(): boolean {
    return this.state === 'failed' && this.retryCount < MAX_RETRIES
  }

  isExpired(): boolean {
    return Date.now() - this.createdAt.getTime() > JOB_TTL_MS
  }
}

// ❌ Domain entity with infrastructure dependency
import { db } from '@/infrastructure/database'  // FORBIDDEN in domain!

export class VideoJob {
  async save(): Promise<void> {
    await db.update(videoJobs).set({ state: this.state })  // infra leak!
  }
}
```

```ts
// ✅ Application handler — orchestrates domain + infrastructure
// src/application/handlers/ProcessVideoHandler.ts
export class ProcessVideoHandler {
  constructor(
    private readonly jobRepo: IJobRepository,
    private readonly processor: IVideoProcessor,
    private readonly publisher: IEventPublisher,
  ) {}

  async handle(command: ProcessVideoCommand): Promise<void> {
    const job = await this.jobRepo.findById(command.jobId)
    if (!job) throw VideoProcessingError.permanent('Job not found', command.jobId)
    const result = await this.processor.process(job)
    await this.jobRepo.update(job.id, { state: 'completed', output: result })
    await this.publisher.publish('VideoProcessed', { jobId: job.id })
  }
}

// ❌ Handler with mixed concerns
export async function handleVideo(jobId: string): Promise<void> {
  const row = await db.select().from(videoJobs).where(eq(videoJobs.id, jobId))  // direct DB
  const result = await ffmpeg(row.url)  // direct FFmpeg
  await s3.upload(result)  // direct S3
  await redis.publish('done', jobId)  // direct Redis — all layers mixed!
}
```

---

## #7 Elegance

```ts
// ✅ for...of — clear iteration, supports break/continue/await
for (const ratio of ASPECT_RATIOS) {
  const output = await processAspectRatio(job, ratio)
  results.push(output)
}

// ❌ forEach — hidden control flow, no break/continue, no await
ASPECT_RATIOS.forEach(async (ratio) => {
  const output = await processAspectRatio(job, ratio)  // fire-and-forget!
  results.push(output)
})
```

---

## #8 Clear Naming

```ts
// ✅ Path aliases — clean imports
import { VideoJob } from '@/domain/entities/VideoJob'
import { IJobRepository } from '@/domain/interfaces/IJobRepository'
import { createTestContext } from '@tests/helpers/test-setup-factory'

// ❌ Relative path hell
import { VideoJob } from '../../../../domain/entities/VideoJob'
import { IJobRepository } from '../../../../domain/interfaces/IJobRepository'
```

```ts
// ✅ Bun-specific: import.meta.dir
const configPath = `${import.meta.dir}/config.json`

// ❌ Node.js pattern — not available in Bun
const configPath = `${__dirname}/config.json`  // __dirname is not defined
```

---

## #9 Documentation & Comments

```ts
// ✅ JSDoc documenting query count for N+1-prone operation
/**
 * Fetches all pending jobs with their outputs.
 * Queries: 1 (JOIN on job_outputs)
 */
async function getPendingJobsWithOutputs(): Promise<JobWithOutputs[]> {
  return db.select().from(videoJobs)
    .innerJoin(jobOutputs, eq(videoJobs.id, jobOutputs.jobId))
    .where(eq(videoJobs.state, 'pending'))
}

// ❌ No query count doc — hard to spot N+1 in review
async function getPendingJobsWithOutputs() {
  return db.select().from(videoJobs)
    .innerJoin(jobOutputs, eq(videoJobs.id, jobOutputs.jobId))
    .where(eq(videoJobs.state, 'pending'))
}
```

---

## #10 Type Safety

```ts
// ✅ Branded types for domain IDs — prevents mixing
type VideoId = string & { readonly _brand: 'VideoId' }
type JobId = string & { readonly _brand: 'JobId' }

function getJob(id: JobId): Promise<VideoJob> { ... }
// getJob(videoId) → compile error ✅

// ❌ Plain string — any ID accepted silently
function getJob(id: string): Promise<VideoJob> { ... }
// getJob(videoId) → compiles but wrong! ❌
```

```ts
// ✅ Discriminated union for job state
type JobState =
  | { state: 'pending' }
  | { state: 'processing'; startedAt: Date }
  | { state: 'completed'; output: VideoOutput }
  | { state: 'failed'; error: ProcessingError; retryCount: number }

// ❌ Boolean flags — combinatorial explosion
type JobState = {
  isPending: boolean
  isProcessing: boolean
  isCompleted: boolean
  isFailed: boolean
  output?: VideoOutput
  error?: ProcessingError
}
```

---

## #11 Testability

```ts
// ✅ Vitest mock pattern — AAA structure
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ProcessVideoHandler', () => {
  let handler: ProcessVideoHandler
  let mockRepo: IJobRepository
  let mockProcessor: IVideoProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo = { findById: vi.fn(), update: vi.fn() } as unknown as IJobRepository
    mockProcessor = { process: vi.fn() } as unknown as IVideoProcessor
    handler = new ProcessVideoHandler(mockRepo, mockProcessor)
  })

  it('processes video and updates state', async () => {
    // Arrange
    const job = createTestJob({ state: 'pending' })
    vi.mocked(mockRepo.findById).mockResolvedValue(job)
    vi.mocked(mockProcessor.process).mockResolvedValue(mockOutput)

    // Act
    await handler.handle({ jobId: job.id })

    // Assert
    expect(mockRepo.update).toHaveBeenCalledWith(job.id, expect.objectContaining({ state: 'completed' }))
  })
})

// ❌ No mocking — requires real infrastructure
it('processes video', async () => {
  const handler = new ProcessVideoHandler()  // needs real DB, FFmpeg, S3!
  await handler.handle({ jobId: 'job-1' })   // flaky, slow, requires infra
})
```

```ts
// ✅ bun run test — correct command
// package.json: "test": "vitest run"
// Run: bun run test

// ❌ bun test — uses Bun's built-in test runner, NOT Vitest
// bun test  ← WRONG! Skips Vitest config, coverage, and custom setup
```

---

## #12 Debugging Friendly

```ts
// ✅ Structured error with correlation and metadata
const logger = LoggerFactory.getLogger({ context: 'VideoWorker' })
logger.error('FFmpeg processing failed', {
  videoId: job.videoId,
  aspectRatio: job.currentRatio,
  correlationId: job.correlationId,
  errorCode: ErrorCodes.FFMPEG_PROCESSING_FAILED,
  error: err.message,
})

// ❌ console.error — no structure, no correlation
console.error('Error:', err)
```

---

## Effect-TS Patterns (tathep-video-processing specific)

```ts
// ✅ Effect.gen for complex async flows
import { Effect, pipe } from 'effect'

const processVideo = Effect.gen(function* () {
  const job = yield* jobRepo.findById(jobId)
  const input = yield* validateInput(job)
  const result = yield* processor.process(input)
  yield* jobRepo.update(jobId, { state: 'completed', output: result })
  return result
})

// ❌ Nested Promise chains — hard to follow
const result = await jobRepo.findById(jobId)
  .then(job => validateInput(job))
  .then(input => processor.process(input))
  .then(result => jobRepo.update(jobId, { state: 'completed', output: result }).then(() => result))
  .catch(err => { throw new Error('failed') })
```

```ts
// ✅ Layer for dependency injection
import { Layer } from 'effect'

const JobRepoLive = Layer.succeed(JobRepo, new DrizzleJobRepository(db))
const ProcessorLive = Layer.succeed(VideoProcessor, new FFmpegProcessor())

const AppLayer = Layer.merge(JobRepoLive, ProcessorLive)

// ❌ Direct instantiation — no DI, hard to test
const repo = new DrizzleJobRepository(db)  // tightly coupled
const processor = new FFmpegProcessor()     // can't swap in tests
```

## DDD Architecture (#13)

```ts
// ✅ Domain interface (port) — no infra dependency
// src/domain/interfaces/IJobRepository.ts
export interface IJobRepository {
  findById(id: JobId): Promise<VideoJob | null>
  update(id: JobId, data: Partial<VideoJob>): Promise<void>
  findPending(limit: number): Promise<VideoJob[]>
}

// ✅ Infrastructure adapter implements port
// src/infrastructure/database/repositories/DrizzleJobRepository.ts
export class DrizzleJobRepository implements IJobRepository {
  constructor(private readonly db: DrizzleClient) {}

  async findById(id: JobId): Promise<VideoJob | null> {
    const row = await this.db.select().from(videoJobs).where(eq(videoJobs.id, id)).limit(1)
    return row[0] ? VideoJob.fromRow(row[0]) : null
  }
}

// ❌ No port — domain depends on infrastructure
// src/domain/entities/VideoJob.ts
import { db } from '@/infrastructure/database'  // DOMAIN IMPORTS INFRA!

export class VideoJob {
  async reload(): Promise<void> {
    const row = await db.select().from(videoJobs).where(eq(videoJobs.id, this.id))
    Object.assign(this, row[0])  // violates DDD isolation
  }
}
```
