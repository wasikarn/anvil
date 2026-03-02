# Code Examples — tathep-platform-api

Examples for rules that are project-specific or counter-intuitive.

---

## #2 Architecture Layers

```ts
// ✅ Correct — Controller delegates only
class UserController {
  async show({ params, response }: HttpContextContract) {
    const result = await this.getUserUseCase.execute(params.id)
    return response.ok(result)
  }
}

// ❌ Business logic in Controller
class UserController {
  async show({ params, response }: HttpContextContract) {
    const user = await User.find(params.id)
    if (!user) return response.notFound({ message: 'User not found' })
    user.lastSeenAt = DateTime.now()
    await user.save()
    return response.ok(user)
  }
}
```

```ts
// ✅ DI via @inject
@inject([InjectPaths.IUserRepo])
export class GetUserUseCase {
  constructor(private userRepo: IUserRepo) {}
}

// ❌ new inside UseCase
export class GetUserUseCase {
  private userRepo = new UserRepo()
}
```

---

## #5 Flatten Structure

```ts
// ✅ Early returns — 1 level max
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

## #7 Effect-TS Usage

```ts
// ✅ Correct imports and composition
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

// ❌ Raw try/catch + throw
try {
  const user = await this.userRepo.findById(id)
  if (!user) throw new Error('User not found')
  return user
} catch (e) {
  throw new Error('Failed')
}
```

```ts
// ✅ Option for nullable
const user: Option.Option<User> = Option.fromNullable(await this.userRepo.find(id))

// ❌ null | undefined
const user: User | null = await this.userRepo.find(id)
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
