# Code Examples — tathep-admin

Examples for rules that are project-specific or counter-intuitive.

---

## #1 Functional Correctness

```ts
// ✅ Check isOk before accessing data
const result = await adServiceV2.getByCode(code)
if (!result.isOk) {
  toast.error('โหลดข้อมูลโฆษณาไม่สำเร็จ')
  return
}
setAd(result.data!)

// ❌ Access data without checking isOk — data may be null
const result = await adServiceV2.getByCode(code)
setAd(result.data) // crashes if request failed
```

```ts
// ✅ Handle empty array edge case
const ads = result.data?.data ?? []
if (ads.length === 0) return <EmptyState />

// ❌ Assume data always exists
const ads = result.data.data // TypeError if isOk is false
```

---

## #2 App Helpers & Util Functions

```ts
// ✅ QUERY_KEYS constant — consistent, invalidatable
const $ads = useQuery(
  [QUERY_KEYS.getAllAds(params)],
  () => adService.getAll(params),
  { keepPreviousData: true, enabled: router.isReady },
)

// ❌ Inline string key — hard to invalidate, typo-prone
const $ads = useQuery(
  [`ads-list-${JSON.stringify(params)}`],
  () => adService.getAll(params),
)
```

```ts
// ✅ ROUTE_PATHS — typed, refactor-safe
router.push(ROUTE_PATHS.advertisement.index())
router.push(ROUTE_PATHS.billboard.edit(id))

// ❌ Hardcoded route — breaks on rename
router.push('/ad')
router.push(`/billboard/${id}/edit`)
```

```ts
// ✅ *_STATUS_TEXT constant — no hardcoded Thai
import { AD_STATUS_TEXT } from '@/modules/ad/constant'
<Badge>{AD_STATUS_TEXT[ad.status]}</Badge>

// ❌ Hardcoded Thai status text
<Badge>กำลังใช้งาน</Badge>   // breaks if status label ever changes
```

```ts
// ✅ ObjectUtil for key transformation
const payload = ObjectUtil.mapKeysToSnakeCase(formData)

// ❌ Manual key mapping — error-prone
const payload = { ad_code: formData.adCode, ad_status: formData.adStatus }
```

---

## #3 N+1 Prevention

```ts
// ✅ Promise.all for independent fetches
const [ads, billboards] = await Promise.all([
  adServiceV2.getAll(params),
  billboardServiceV2.getAll(),
])

// ❌ Sequential await — doubles load time for independent data
const ads = await adServiceV2.getAll(params)
const billboards = await billboardServiceV2.getAll()
```

```ts
// ✅ includes= for server-side eager load
const result = await adServiceV2.getAll({
  ...params,
  includes: 'campaign,billboard,screen',
})

// ❌ Separate requests per ad
const ads = await adServiceV2.getAll(params)
for (const ad of ads.data) {
  ad.campaign = await campaignServiceV2.getByCode(ad.campaignCode) // N requests!
}
```

---

## #4 DRY & Simplicity

```tsx
// ✅ Extract repeated status badge
const AdStatusBadge = ({ status }: { status: AdStatus }) => (
  <Badge color={AD_STATUS_COLOR[status]}>{AD_STATUS_TEXT[status]}</Badge>
)

// ❌ Same badge repeated across 3 components
<Badge color="green">กำลังใช้งาน</Badge>
// ... component 2
<Badge color="green">กำลังใช้งาน</Badge>
// ... component 3
<Badge color="green">กำลังใช้งาน</Badge>
```

```ts
// ✅ Derive state — no sync needed
const fullName = `${admin.firstName} ${admin.lastName}`

// ❌ Sync derived state with useEffect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${admin.firstName} ${admin.lastName}`)
}, [admin])
```

---

## #5 Flatten Structure

```ts
// ✅ Early returns — max 1 level
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

## #6 Small Function & SOLID

```tsx
// ✅ Page: thin wrapper with getLayout
const BillboardPage: NextPageWithLayout = () => {
  return <BillboardPageContent />
}
BillboardPage.getLayout = (page) => (
  <ManageLayout title="บิลบอร์ด">{page}</ManageLayout>
)
export default BillboardPage

// ❌ Data fetching mixed into page component
const BillboardPage: NextPageWithLayout = () => {
  const [billboards, setBillboards] = useState([])
  useEffect(() => {
    billboardServiceV2.getAll().then(r => {
      if (r.isOk) setBillboards(r.data)
    })
  }, [])
  return <BillboardTable billboards={billboards} />
}
```

```tsx
// ✅ SRP: separate data hook from presentation
const useAdList = (params: AdParams) =>
  useQuery(
    [QUERY_KEYS.getAllAds(params)],
    () => adService.getAll(params),
    { keepPreviousData: true, enabled: router.isReady },
  )

// ❌ Fetch + transform + render all in one component
const AdList = ({ params }) => {
  const $data = useQuery([...], () => adService.getAll(params))
  const filtered = ($data.data?.data ?? []).filter(a => a.status === 'active')
  // ... 80+ more lines
}
```

```tsx
// ✅ Explicit variant components — no boolean prop proliferation
function AdTable() {
  return <AdRows />
}
function AdSelectModal({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <Modal>
      <AdRows onSelect={onSelect} />
    </Modal>
  )
}

// ❌ Boolean props — each new flag doubles possible states
function AdTable({
  isModal,
  isSelectable,
  isReadOnly,
  onSelect,
}: Props) {
  return (
    <div>
      {isModal && <ModalHeader />}
      {isSelectable ? (
        <SelectableAdRows onSelect={onSelect} />
      ) : isReadOnly ? (
        <ReadOnlyAdRows />
      ) : (
        <EditableAdRows />
      )}
    </div>
  )
}
```

---

## #7 Elegance

```tsx
// ✅ Derive loading/error state — reads naturally
const isLoading = $ads.isLoading || $billboards.isLoading

if (isLoading) return <Spinner />
return <Dashboard ads={$ads.data} billboards={$billboards.data} />

// ❌ Sync derived state with useEffect
const [isLoading, setIsLoading] = useState(false)
useEffect(() => {
  setIsLoading($ads.isLoading || $billboards.isLoading)
}, [$ads.isLoading, $billboards.isLoading])
```

```tsx
// ✅ STATUS_TEXT constant — consistent, maintainable
<Badge>{AD_STATUS_TEXT[ad.status]}</Badge>

// ❌ Inline Thai string — hardcoded, breaks on status rename
<Badge>{ad.status === 'active' ? 'กำลังใช้งาน' : 'ปิดใช้งาน'}</Badge>
```

---

## #8 Clear Naming

```tsx
// ✅ Boolean: is/has prefix
const isLoading = $ads.isLoading
const hasAdminRole = user?.roles?.includes(ROLE.ADMIN) ?? false
const isFormDirty = methods.formState.isDirty

// ❌ Ambiguous
const loading = $ads.isLoading
const admin = user?.roles?.includes(ROLE.ADMIN) ?? false
```

```tsx
// ✅ Event handlers: handle prefix
const handleSubmit = async (data: FormData) => { ... }
const handleDelete = (code: string) => { ... }
const handleStatusChange = (status: AdStatus) => { ... }

// ❌ Vague handler names
const submit = async (data: FormData) => { ... }
const del = (code: string) => { ... }
const change = (status: AdStatus) => { ... }
```

```tsx
// ✅ Query hooks: $ prefix
const $ads = useQuery(...)
const $campaigns = useQuery(...)

// ❌ No convention — query state mixed with plain data
const ads = useQuery(...)
const adsData = useQuery(...)
```

---

## #9 Documentation & Comments

```tsx
// ✅ WHY comment — non-obvious behavior
// keepPreviousData must be false when filter params change:
// admin expects blank state immediately on filter clear, not stale rows
const $ads = useQuery({
  queryKey: [QUERY_KEYS.getAllAds(params)],
  queryFn: () => adService.getAll(params),
  keepPreviousData: !hasFilterChanged,
  enabled: router.isReady,
})

// ❌ No comment on counter-intuitive false
const $ads = useQuery({ ..., keepPreviousData: false })
```

```ts
// ✅ TODO linked to ticket
// TODO BEP-5678: Migrate to adServiceV2 once v1 endpoints are deprecated
const result = await adService.getAll(params)

// ❌ Orphan TODO
// TODO: use v2 later
```

---

## #10 Type Safety

```ts
// ✅ Mapper with explicit return type — no as any
function mapAdResponse(raw: AdResponse): IAd {
  return {
    id: raw.id,
    code: raw.code,
    status: raw.ad_status as AdStatus,
    displayStage: raw.display_stage?.stage ?? null,
  }
}

// ❌ as any shortcut
const ad = raw as any as IAd
```

```ts
// ✅ Discriminated union over boolean flags
type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: IAd }
  | { status: 'error'; message: string }

// ❌ Loose flags
type FormState = { loading: boolean; data?: IAd; error?: string }
```

```ts
// ✅ Check result.isOk before result.data
const result = await adServiceV2.getByCode(code)
if (!result.isOk) return showError(result.error)
renderAd(result.data!)

// ❌ Access data directly — data may be null
const result = await adServiceV2.getByCode(code)
renderAd(result.data) // crashes if isOk is false
```

```ts
// ✅ satisfies — validates all keys covered, no type widening
import { AdStatus } from '@/modules/ad/types'

const AD_STATUS_TEXT = {
  active: 'กำลังใช้งาน',
  inactive: 'ปิดใช้งาน',
  pending: 'รอดำเนินการ',
} satisfies Record<AdStatus, string>
// TypeScript error if new AdStatus added but not handled ✅

// ❌ as — silently accepts incomplete map; new status causes runtime undefined
const AD_STATUS_TEXT = {
  active: 'กำลังใช้งาน',
  inactive: 'ปิดใช้งาน',
} as Record<AdStatus, string>  // 'pending' missing, no error ❌
```

---

## #11 Testability

```ts
// ✅ Pure mapper — unit-testable with Vitest
export const mapAd = (data: any): IAd => ({
  id: data.id,
  code: data.code,
  status: data.ad_status,
  displayStage: data.display_stage?.stage ?? null,
})

// Vitest test:
import { describe, it, expect } from 'vitest'
import { mapAd } from '../ad.map'

describe('mapAd', () => {
  it('maps ad_status to status', () => {
    const result = mapAd({ id: 'ad-1', code: 'A001', ad_status: 'active', display_stage: null })
    expect(result.status).toBe('active')
    expect(result.displayStage).toBeNull()
  })

  it('maps display_stage.stage when present', () => {
    const result = mapAd({ id: 'ad-1', code: 'A001', ad_status: 'active', display_stage: { stage: 'playing' } })
    expect(result.displayStage).toBe('playing')
  })
})

// ❌ Side effect in mapper — breaks unit test
export const mapAndCacheAd = async (data: any): Promise<IAd> => {
  const mapped = { id: data.id, code: data.code }
  await adCache.set(mapped.id, mapped) // side effect!
  return mapped
}
```

```ts
// ✅ Vitest mock pattern
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/shared/libs/storage', () => ({
  cookieStorage: { getItem: vi.fn() },
}))

describe('OFetchAdapter', () => {
  let mockOfetch: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vi.clearAllMocks()
    mockOfetch = vi.fn()
  })

  it('returns mapped ad on success', async () => {
    mockOfetch.mockResolvedValue({ id: 'ad-123', ad_status: 'active' })
    const adapter = new OFetchAdapter(mockOfetch, BASE_URL, '/advertisements')
    const result = await adapter.get('/ad-123')
    expect(result.isOk).toBe(true)
  })
})
```

---

## #12 Debugging Friendly

```ts
// ✅ Surface error with context
const result = await adServiceV2.deleteByCode(code)
if (!result.isOk) {
  console.error('[AdDelete] Failed:', result.error)
  toast.error(`ลบโฆษณาไม่สำเร็จ: ${result.error?.message}`)
  return
}

// ❌ Silent failure — user sees nothing, action not taken
const result = await adServiceV2.deleteByCode(code)
router.push(ROUTE_PATHS.advertisement.index()) // proceeds even if delete failed
```

```tsx
// ✅ Error boundary with useful message
if ($ads.isError) {
  return <ErrorState message="โหลดข้อมูลโฆษณาไม่สำเร็จ กรุณารีเฟรชหน้า" />
}

// ❌ Swallow query error — blank screen with no explanation
if ($ads.isError) return null
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
const fullName = `${admin.firstName} ${admin.lastName}`

// ❌ Sync derived state with useEffect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${admin.firstName} ${admin.lastName}`)
}, [admin])
```

```tsx
// ✅ Functional setState — stable callback, no stale closure
function AdList() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])

  const handleSelect = useCallback((code: string) => {
    setSelectedCodes(curr => [...curr, code])  // always latest state
  }, [])  // stable — no deps needed

  const handleDeselect = useCallback((code: string) => {
    setSelectedCodes(curr => curr.filter(c => c !== code))
  }, [])

  return <AdTable onSelect={handleSelect} onDeselect={handleDeselect} />
}

// ❌ Direct setState — stale closure + useCallback must depend on state
function AdList() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])

  const handleSelect = useCallback((code: string) => {
    setSelectedCodes([...selectedCodes, code])  // stale if deps missing
  }, [selectedCodes])  // recreated every selection ❌

  return <AdTable onSelect={handleSelect} />
}
```

```tsx
// ✅ Lazy initial state — expensive parse runs once on mount
function AdFilterPanel() {
  const [filters, setFilters] = useState(() => parseFiltersFromQuery(router.query))
  // parseFiltersFromQuery() called once ✅
}

// ❌ Eager evaluation — runs on every render
function AdFilterPanel() {
  const [filters, setFilters] = useState(parseFiltersFromQuery(router.query))
  // parseFiltersFromQuery() called on every render ❌
}
```
