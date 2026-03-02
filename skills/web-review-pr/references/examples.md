# Code Examples — tathep-website

Examples for rules that are project-specific or counter-intuitive.

---

## #5 Flatten Structure

```ts
// ✅ Early returns — 1 level max
function getPlayerStatus(player: IPlayer) {
  if (!player.isActive) return 'inactive'
  if (player.isBanned) return 'banned'
  return 'active'
}

// ❌ Nested conditions
function getPlayerStatus(player: IPlayer) {
  if (player.isActive) {
    if (player.isBanned) {
      return 'banned'
    } else {
      return 'active'
    }
  } else {
    return 'inactive'
  }
}
```

---

## #10 Type Safety

```ts
// ✅ IFetchResult — check isOk before .data
const result = await fetchUser(id)
if (!result.isOk) return showError(result.error)
renderUser(result.data)

// ❌ Access .data without checking
const result = await fetchUser(id)
renderUser(result.data) // may be undefined
```

```ts
// ✅ Discriminated union over boolean flags
type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: IUser }
  | { status: 'error'; message: string }

// ❌ Loose flags
type FormState = { loading: boolean; data?: IUser; error?: string }
```

```ts
// ✅ Narrow unknown API response with type guard
function isUserResponse(data: unknown): data is UserResponse {
  return typeof data === 'object' && data !== null && 'id' in data
}

// ❌ Cast unknown directly
const user = apiResponse as UserResponse
```

---

## #13 React Performance

```tsx
// ✅ Extract stable reference
const buttonStyle = { color: 'red' } // outside component or useMemo

function MyComponent() {
  return <Button style={buttonStyle} />
}

// ❌ Inline object creates new ref every render
function MyComponent() {
  return <Button style={{ color: 'red' }} />
}
```

```tsx
// ✅ useCallback for memoized children
const handleDelete = useCallback(() => deleteItem(id), [id])
return <MemoizedRow onDelete={handleDelete} />

// ❌ Inline function breaks memoization
return <MemoizedRow onDelete={() => deleteItem(id)} />
```

```tsx
// ✅ Derive state — no useEffect sync
const fullName = `${user.firstName} ${user.lastName}`

// ❌ Sync derived state with useEffect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${user.firstName} ${user.lastName}`)
}, [user])
```

```tsx
// ✅ useTranslations from shared lib
import { useTranslations } from '@/shared/libs/locale'

// ❌ next-intl directly
import { useTranslations } from 'next-intl'
```
