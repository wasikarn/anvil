# Code Examples — tathep-platform-api

Examples for rules that are project-specific or counter-intuitive.

---

## #1 Functional Correctness

```ts
// ✅ Null check before use + typed result
public async execute(input: GetUserInputDTO): Promise<Result<GetUserOutputDTO>> {
  try {
    const user = await this.userRepo.findById(input.userId)
    if (!user) throw UserException.notFound(input.userId)
    return this.success({ data: { user } })
  } catch (error: unknown) {
    Logger.error({ error, location: 'GetUserUseCase.execute' }, 'Failed to get user')
    return this.error(error, input.requestId)
  }
}

// ❌ No null check — NPE at runtime
public async execute(input: GetUserInputDTO): Promise<Result<GetUserOutputDTO>> {
  const user = await this.userRepo.findById(input.userId)
  return this.success({ data: { user } }) // user might be null!
}
```

---

## #2 App Helpers & Util Functions

```ts
// ✅ Logger from App/Helpers/Logger — structured, filterable
import Logger from 'App/Helpers/Logger'
Logger.info({ requestId: input.requestId, phone: input.phone }, 'Adding SMS test phone')
Logger.error({ error, location: 'AddSmsTestPhoneUseCase.execute' }, 'Failed to add SMS test phone')

// ❌ console.log — not structured, not filterable, forbidden by Biome
console.log('Adding SMS test phone', input.phone)
console.error('Failed:', error)
```

```ts
// ✅ tryCatch helper for controller-level external calls
import { tryCatch } from 'App/Helpers/TryCatch'
const { error, data } = await tryCatch(externalPaymentService.charge(amount))
if (error) {
  Logger.error({ error }, 'Payment charge failed')
  return
}

// ❌ Raw try/catch scattered everywhere — no consistency
try {
  const result = await externalPaymentService.charge(amount)
} catch (e) {
  // each caller handles differently
}
```

```ts
// ✅ DatabaseErrorUtil for duplicate detection
import { DatabaseErrorUtil } from 'App/Helpers/DatabaseErrorUtil'
if (DatabaseErrorUtil.isDuplicateKeyError(error)) {
  throw SmsTestPhoneException.exists(input.phone)
}

// ❌ String-matching error messages — breaks on DB engine changes
if (error.message.includes('Duplicate entry')) {
  throw new Error('Duplicate phone number')
}
```

---

## #3 N+1 Prevention

```ts
// ✅ preload — 2 queries total
const campaigns = await Campaign.query()
  .preload('adGroups')
  .preload('screens')
  .orderBy('created_at', 'desc')

// ❌ N+1 — 1 + N queries
const campaigns = await Campaign.all()
for (const campaign of campaigns) {
  campaign.adGroups = await AdGroup.query().where('campaign_id', campaign.id)
  campaign.screens = await Screen.query().where('campaign_id', campaign.id)
}
```

```ts
// ✅ Promise.all for independent queries
const [users, campaigns] = await Promise.all([
  this.userRepo.findAll(),
  this.campaignRepo.findAll(),
])

// ❌ Sequential await — unnecessary wait
const users = await this.userRepo.findAll()
const campaigns = await this.campaignRepo.findAll() // waits for users first
```

```ts
// ✅ whereHas for filtering by relation
const activeUsers = await User.query()
  .whereHas('subscriptions', (builder) => {
    builder.where('status', 'active')
  })

// ❌ innerJoin — forbidden in this project
const activeUsers = await User.query()
  .innerJoin('subscriptions', 'users.id', 'subscriptions.user_id')
  .where('subscriptions.status', 'active')
```

---

## #4 DRY & Simplicity

```ts
// ✅ Extract repeated guard logic
const isValidThaiPhone = (phone: string) => THAI_MOBILE_PHONE_REGEX.test(phone)

if (!isValidThaiPhone(input.phone)) throw SmsTestPhoneException.invalidPhoneFormat(input.phone)

// ❌ Same validation duplicated across use cases
// In AddSmsTestPhoneUseCase:
if (!THAI_MOBILE_PHONE_REGEX.test(input.phone)) throw SmsTestPhoneException.invalidPhoneFormat(input.phone)
// In BulkAddSmsTestPhonesUseCase — exact copy:
if (!THAI_MOBILE_PHONE_REGEX.test(input.phone)) throw SmsTestPhoneException.invalidPhoneFormat(input.phone)
```

```ts
// ✅ No redundant condition
if (user.isActive) return this.success({ data: { user } })

// ❌ Redundant === true
if (user.isActive === true) return this.success({ data: { user } })
```

---

## #5 Flatten Structure

```ts
// ✅ Early returns — max 1 level
async execute(userId: string) {
  const user = await this.userRepo.findById(userId)
  if (!user) throw ModuleException.type('USER_NOT_FOUND')
  if (!user.isActive) throw ModuleException.type('USER_INACTIVE')
  return user
}

// ❌ Nested conditions
async execute(userId: string) {
  const user = await this.userRepo.findById(userId)
  if (user) {
    if (user.isActive) {
      return user
    } else {
      throw ModuleException.type('USER_INACTIVE')
    }
  } else {
    throw ModuleException.type('USER_NOT_FOUND')
  }
}
```

---

## #6 Small Function & SOLID

```ts
// ✅ Controller: thin — validate → delegate → respond
public async store({ auth: { user }, request, response }: HttpContextContract) {
  const payload = await request.validate(AddSmsTestPhoneValidator)
  const result = await this.addUseCase.execute({
    requestId: request.id() || '',
    adminCode: user?.code,
    phone: payload.phone,
    description: payload.description ?? null,
  })
  if (!result.success) return this.errorResponse({ ...result, response })
  const transformed = await TransformManager.item(result.data?.testPhone, SmsTestPhoneTransformer)
  return this.successResponse({ data: transformed, response })
}

// ❌ Business logic in Controller
public async store({ request, response }: HttpContextContract) {
  const phone = request.input('phone')
  if (!THAI_MOBILE_PHONE_REGEX.test(phone)) {
    return response.badRequest({ message: 'Invalid phone format' })
  }
  const existing = await SmsTestPhoneNumber.findBy('phone', phone)
  if (existing) return response.conflict({ message: 'Phone already exists' })
  const testPhone = await SmsTestPhoneNumber.create({ phone })
  return response.created({ data: testPhone })
}
```

```ts
// ✅ DI via @inject — depend on interface, injectable in tests
@inject([InjectRepositoryPaths.I_SMS_TEST_PHONE_REPOSITORY])
export default class AddSmsTestPhoneUseCase extends UseCase<AddSmsTestPhoneOutputDTO> {
  constructor(private repository: ISmsTestPhoneRepository) { super() }
}

// ❌ new inside class — hardcoded dependency, cannot mock
export default class AddSmsTestPhoneUseCase extends UseCase<AddSmsTestPhoneOutputDTO> {
  private repository = new SmsTestPhoneRepository()
}
```

```ts
// ✅ Repository: data access only
export class SmsTestPhoneRepository implements ISmsTestPhoneRepository {
  public async findByPhone(phone: string): Promise<SmsTestPhoneNumber | null> {
    return SmsTestPhoneNumber.findBy('phone', phone)
  }
}

// ❌ Business logic leaked into Repository
export class SmsTestPhoneRepository implements ISmsTestPhoneRepository {
  public async findByPhone(phone: string): Promise<SmsTestPhoneNumber | null> {
    const result = await SmsTestPhoneNumber.findBy('phone', phone)
    if (!result) throw new Error('Phone not found') // business logic belongs in UseCase
    return result
  }
}
```

---

## #7 Elegance

```ts
// ✅ Clear pipeline — reads like prose
public async execute(input: AddSmsTestPhoneInputDTO): Promise<Result<AddSmsTestPhoneOutputDTO>> {
  try {
    Logger.info({ requestId: input.requestId, phone: input.phone }, 'Adding SMS test phone number')
    if (!THAI_MOBILE_PHONE_REGEX.test(input.phone)) throw SmsTestPhoneException.invalidPhoneFormat(input.phone)
    const existing = await this.repository.findByPhone(input.phone)
    if (existing) throw SmsTestPhoneException.exists(input.phone)
    const testPhone = await this.repository.create({ phone: input.phone, description: input.description ?? null })
    return this.success({ data: { testPhone } })
  } catch (error: unknown) {
    Logger.error({ error, location: 'AddSmsTestPhoneUseCase.execute' }, 'Failed to add SMS test phone number')
    return this.error(error, input.requestId)
  }
}

// ❌ Obscure — abbreviated names, single-letter vars, no readability
public async execute(i: any) {
  try {
    Logger.info({ r: i.rId, p: i.ph }, 'Adding...')
    if (!R.test(i.ph)) throw SmsTestPhoneException.invalidPhoneFormat(i.ph)
    const e = await this.r.fByP(i.ph)
    if (e) throw SmsTestPhoneException.exists(i.ph)
    return this.s({ data: { tp: await this.r.c({ p: i.ph, d: i.desc ?? null }) } })
  } catch (err) { return this.e(err, i.rId) }
}
```

---

## #8 Clear Naming

```ts
// ✅ Boolean: is/has/can prefix
const isActive = user.status === 'active'
const hasPermission = adminRoles.includes(ROLE.ADMIN)
const canDelete = user.isOwner && !resource.isLocked

// ❌ Ambiguous — noun or adjective?
const active = user.status === 'active'
const permission = adminRoles.includes(ROLE.ADMIN)
```

```ts
// ✅ Function: verb + noun
async getUserById(id: string): Promise<User | null> { ... }
async createSmsTestPhone(input: CreateInput): Promise<SmsTestPhone> { ... }
async validateThaiPhoneFormat(phone: string): Promise<boolean> { ... }

// ❌ Ambiguous — what does it do?
async user(id: string) { ... }       // get? create? update?
async sms() { ... }                  // too vague
async check(phone: string) { ... }   // check what?
```

```ts
// ✅ DTO: {Op}{Resource}InputDTO with readonly fields
interface AddSmsTestPhoneInputDTO {
  readonly requestId: string
  readonly adminCode?: string
  readonly phone: string
  readonly description?: string | null
}

// ❌ No naming convention, mutable fields
interface SmsData {
  phone: string     // mutable
  desc?: string     // abbreviation
}
```

---

## #9 Documentation & Comments

```ts
// ✅ WHY comment — non-obvious regex rule
// Thai mobile: starts with 06, 08, 09 + exactly 8 digits (10 total)
// Excludes landlines (02-05) and special numbers (01, 07)
const THAI_MOBILE_PHONE_REGEX = /^0[689]\d{8}$/

// ❌ WHAT comment — obvious from code itself
// Check if phone matches regex
if (THAI_MOBILE_PHONE_REGEX.test(phone)) { ... }
```

```ts
// ✅ TODO linked to ticket
// TODO BEP-1234: Add rate limiting for bulk operations once Redis quota is allocated
const MAX_BULK_SIZE = 100

// ❌ Orphan TODO — no ticket, no context
// TODO: fix this later
const MAX_BULK_SIZE = 100
```

---

## #10 Type Safety

```ts
// ✅ Discriminated union over boolean flags
type AuthResult =
  | { ok: true; user: User }
  | { ok: false; error: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' }

// ❌ Boolean flags lose type narrowing
type AuthResult = { success: boolean; user?: User; error?: string }
```

```ts
// ✅ Branded type for domain IDs
type UserId = string & { readonly _brand: 'UserId' }
type PlayerId = string & { readonly _brand: 'PlayerId' }

function getUser(id: UserId) { ... }
// getUser(playerId) → compile error ✅

// ❌ Plain string — any ID accepted silently
function getUser(id: string) { ... }
```

```ts
// ✅ Typed mock — no as any
const userRepo = createStubObj<IUserRepo>({
  findById: sinon.stub().resolves(fromPartial<User>({ id: '1' })),
})

// ❌ as any cast
const userRepo = { findById: sinon.stub() } as any
```

```ts
// ✅ satisfies — validates all keys covered, no type widening
import { SmsStatus } from '@/Modules/Sms/Commons/Types'

const SMS_STATUS_TEXT = {
  pending: 'รอส่ง',
  sent: 'ส่งแล้ว',
  failed: 'ส่งไม่สำเร็จ',
} satisfies Record<SmsStatus, string>
// TypeScript error if new SmsStatus added but not handled ✅

// ❌ as — silently accepts incomplete map; new status causes runtime undefined
const SMS_STATUS_TEXT = {
  pending: 'รอส่ง',
  sent: 'ส่งแล้ว',
} as Record<SmsStatus, string>  // no error when 'failed' is missing ❌
```

---

## #11 Testability

```ts
// ✅ Injectable — easy to test with stubs
@inject([InjectRepositoryPaths.I_SMS_TEST_PHONE_REPOSITORY])
export class AddSmsTestPhoneUseCase extends UseCase<AddSmsTestPhoneOutputDTO> {
  constructor(private repository: ISmsTestPhoneRepository) { super() }
}

// In tests:
const repository = createStubObj<ISmsTestPhoneRepository>({
  findByPhone: sinon.stub().resolves(null),
  create: sinon.stub().resolves(fromPartial<SmsTestPhoneNumber>({ phone: '0891234567' })),
})
const useCase = new AddSmsTestPhoneUseCase(repository)
const result = await useCase.execute({ requestId: 'req-1', phone: '0891234567', description: null })
assert.isTrue(result.success)

// ❌ Hardcoded dependency — cannot mock in tests
export class AddSmsTestPhoneUseCase extends UseCase<AddSmsTestPhoneOutputDTO> {
  private repository = new SmsTestPhoneRepository() // impossible to override
}
```

```ts
// ✅ Transaction rollback — tests are isolated
group.each.setup(async () => {
  await Database.beginGlobalTransaction()
})
group.each.teardown(async () => {
  await Database.rollbackGlobalTransaction()
  sinon.restore()
})

// ❌ No isolation — tests pollute each other
test('create user', async () => {
  await User.create({ email: 'test@test.com' }) // persists to DB, breaks other tests
})
```

---

## #12 Debugging Friendly

```ts
// ✅ Meaningful error with full context
Logger.error(
  { error, location: 'AddSmsTestPhoneUseCase.execute', phone: input.phone, requestId: input.requestId },
  'Failed to add SMS test phone number',
)
throw SmsTestPhoneException.createFailed(input.phone, (error as Error).message)

// ❌ Swallowed error — invisible failure
try {
  await this.repository.create(data)
} catch {} // silent! no log, no rethrow, caller thinks it succeeded
```

```ts
// ✅ Exception type distinguishes categories
throw SmsTestPhoneException.exists(input.phone)     // 409 Conflict
throw SmsTestPhoneException.notFound(input.phone)   // 404 Not Found
throw SmsTestPhoneException.createFailed(input.phone, err.message) // 500 with context

// ❌ Generic error — no actionable info
throw new Error('Operation failed')
```

---

## Effect-TS Patterns (tathep-platform-api specific)

```ts
// ✅ Option for nullable results
import { Option } from 'App/Helpers/Effect'
const user: Option.Option<User> = Option.fromNullable(await this.userRepo.find(id))

// ❌ null | undefined directly
const user: User | null = await this.userRepo.find(id)
```

```ts
// ✅ Effect.pipe for composition
import { TryCatch } from 'App/Helpers/TryCatch'
import { Option, Effect } from 'App/Helpers/Effect'

const result = await Effect.pipe(
  TryCatch(() => this.userRepo.findById(id)),
  Effect.map(Option.fromNullable),
  Effect.flatMap(Option.match({
    onNone: () => Effect.fail(ModuleException.type('USER_NOT_FOUND')),
    onSome: (user) => Effect.succeed(user),
  })),
)

// ❌ Raw try/catch + throw new Error
try {
  const user = await this.userRepo.findById(id)
  if (!user) throw new Error('User not found')
  return user
} catch (e) {
  throw new Error('Failed')
}
```
