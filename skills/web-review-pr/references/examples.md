# Code Examples — tathep-website

Examples for rules that are project-specific or counter-intuitive.

---

## #1 Functional Correctness

```ts
// ✅ Check isOk before accessing data
const result = await campaignServiceV2.getByCode(code)
if (!result.isOk) {
  alertDialog.current?.show({ title: 'ไม่พบแคมเปญ', description: result.error?.message })
  return
}
renderCampaign(result.data!)

// ❌ Access data without checking isOk — data may be null
const result = await campaignServiceV2.getByCode(code)
renderCampaign(result.data) // crashes if request failed
```

```ts
// ✅ Handle empty array edge case
const campaigns = result.data?.data ?? []
if (campaigns.length === 0) return <EmptyState />

// ❌ Assume data always exists
const campaigns = result.data.data // TypeError if isOk is false
```

---

## #2 App Helpers & Util Functions

```ts
// ✅ QUERY_KEYS constant — consistent, invalidatable
const $campaigns = useQuery(
  [QUERY_KEYS.getAllCampaigns({ ...pagination, ...params })],
  () => campaignServiceV2.getAll({ ...pagination, ...params }),
)

// ❌ Inline string key — hard to invalidate, typo-prone
const $campaigns = useQuery(
  [`campaigns-${JSON.stringify(params)}`],
  () => campaignServiceV2.getAll(params),
)
```

```ts
// ✅ ROUTE_PATHS — typed, refactor-safe
router.push(ROUTE_PATHS.manage.campaign.edit(campaignCode))
router.push(ROUTE_PATHS.manage.campaign.index())

// ❌ Hardcoded route — breaks on rename, no type safety
router.push(`/manage/campaign/${campaignCode}/edit`)
router.push('/manage/campaign')
```

```ts
// ✅ ObjectUtil for key transformation
const payload = ObjectUtil.mapKeysToSnakeCase(formData)
const mapped = ObjectUtil.mapKeysToCamelCase(apiResponse)

// ❌ Manual key mapping — repetitive, error-prone
const payload = { campaign_code: formData.campaignCode, ad_status: formData.adStatus }
```

```ts
// ✅ appConfig for env vars
const apiUrl = appConfig.apiBaseUrl

// ❌ process.env directly — not centralized, breaks on rename
const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL
```

---

## #3 N+1 Prevention

```ts
// ✅ Promise.all for independent fetches
const [campaigns, billboards] = await Promise.all([
  campaignServiceV2.getAll(),
  billboardServiceV2.getAll(),
])

// ❌ Sequential await — doubles load time for independent data
const campaigns = await campaignServiceV2.getAll()
const billboards = await billboardServiceV2.getAll()
```

```ts
// ✅ includes= param for server-side eager loading
const result = await campaignServiceV2.getAll({
  ...pagination,
  includes: 'total_allocated,total_impressions,issues',
})

// ❌ Separate requests per campaign to get metrics
const campaigns = await campaignServiceV2.getAll(pagination)
for (const c of campaigns.data) {
  c.metrics = await campaignServiceV2.getMetrics(c.code) // N requests!
}
```

---

## #4 DRY & Simplicity

```tsx
// ✅ Extract repeated status badge into component
const StatusBadge = ({ status }: { status: AdStatus }) => (
  <Badge colorScheme={STATUS_COLOR[status]}>{AD_STATUS_TEXT[status]}</Badge>
)

// ❌ Same badge repeated across 3 files
<Badge colorScheme="green">กำลังใช้งาน</Badge>
// ... file 2
<Badge colorScheme="green">กำลังใช้งาน</Badge>
// ... file 3
<Badge colorScheme="green">กำลังใช้งาน</Badge>
```

```ts
// ✅ Derive state — no sync needed
const fullName = `${user.firstName} ${user.lastName}`

// ❌ Synced state — unnecessary useEffect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(`${user.firstName} ${user.lastName}`)
}, [user])
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
const CampaignDashboardPage: NextPageWithLayout = () => {
  return <CampaignDashboardPageContent />
}
CampaignDashboardPage.getLayout = (page) => (
  <CampaignLayout title="แคมเปญ">{page}</CampaignLayout>
)
export default CampaignDashboardPage

// ❌ Data fetching mixed into page component
const CampaignDashboardPage: NextPageWithLayout = () => {
  const [campaigns, setCampaigns] = useState([])
  useEffect(() => {
    campaignServiceV2.getAll().then(r => {
      if (r.isOk) setCampaigns(r.data)
    })
  }, [])
  return <CampaignTable campaigns={campaigns} />
}
```

```tsx
// ✅ SRP: separate data hook from presentation
const useCampaigns = (params: CampaignParams) => {
  return useQuery(
    [QUERY_KEYS.getAllCampaigns(params)],
    () => campaignServiceV2.getAll(params),
  )
}

// ❌ Fetch + transform + render all in one component (100+ lines)
const CampaignList = ({ params }) => {
  const $data = useQuery([...], () => campaignServiceV2.getAll(params))
  const mapped = $data.data?.data.map(mapCampaign) ?? []
  const filtered = mapped.filter(c => c.isActive)
  // ... 80 more lines
}
```

```tsx
// ✅ Explicit variant components — no boolean prop proliferation
function CampaignListPage() {
  return <CampaignTable />
}
function CampaignSelectModal({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <Modal>
      <CampaignTable onSelect={onSelect} />
    </Modal>
  )
}
function CampaignCompactView() {
  return <CampaignTable compact />
}

// ❌ Boolean props create exponential complexity — hard to reason about
function CampaignTable({
  isModal,
  isCompact,
  isSelectable,
  onSelect,
}: Props) {
  return (
    <div>
      {isModal && <ModalHeader />}
      {isSelectable ? (
        <SelectableRows onSelect={onSelect} />
      ) : isCompact ? (
        <CompactRows />
      ) : (
        <FullRows />
      )}
    </div>
  )
}
```

---

## #7 Elegance

```tsx
// ✅ Derive loading/error state — reads naturally
const isLoading = $campaigns.isLoading || $billboards.isLoading
const hasError = $campaigns.isError || $billboards.isError

if (isLoading) return <Spinner />
if (hasError) return <ErrorState />
return <Dashboard campaigns={$campaigns.data} />

// ❌ Sync derived state with useEffect — unnecessary complexity
const [isLoading, setIsLoading] = useState(false)
useEffect(() => {
  setIsLoading($campaigns.isLoading || $billboards.isLoading)
}, [$campaigns.isLoading, $billboards.isLoading])
```

```tsx
// ✅ useTranslations — explicit, typed namespace
const t = useTranslations('CampaignDashboard')
return <Text>{t('title')}</Text>

// ❌ Hardcoded Thai string
return <Text>แดชบอร์ดแคมเปญ</Text>
```

---

## #8 Clear Naming

```tsx
// ✅ Boolean: is/has prefix
const isAuthenticated = !!user
const hasAdminRole = user?.roles?.includes(ROLE.ADMIN) ?? false
const isFormDirty = methods.formState.isDirty

// ❌ Ambiguous
const auth = !!user
const admin = user?.roles?.includes(ROLE.ADMIN) ?? false
```

```tsx
// ✅ Event handlers: handle prefix
const handleSubmit = async (data: FormData) => { ... }
const handleDelete = (id: string) => { ... }
const handlePageChange = (page: number) => { ... }

// ❌ Vague handler names
const submit = async (data: FormData) => { ... }
const doDelete = (id: string) => { ... }
const page = (p: number) => { ... }
```

```tsx
// ✅ Query hooks: $ prefix, plural noun
const $campaigns = useQuery(...)
const $billboards = useQuery(...)

// ❌ No convention — hard to distinguish query state from plain data
const campaigns = useQuery(...)
const campaignData = useQuery(...)
```

---

## #9 Documentation & Comments

```tsx
// ✅ WHY comment — non-obvious behavior
// keepPreviousData must be false when filter changes:
// user expects blank state immediately, not stale data while loading
const $campaigns = useQuery({
  queryKey: [QUERY_KEYS.getAllCampaigns(params)],
  queryFn: () => campaignServiceV2.getAll(params),
  keepPreviousData: !hasFilterChanged,
})

// ❌ No comment on counter-intuitive false — reader doesn't know why
const $campaigns = useQuery({ ..., keepPreviousData: false })
```

```tsx
// ✅ TODO linked to ticket
// TODO BEP-1234: Replace with useInfiniteQuery once pagination UX is approved
const $campaigns = useQuery(...)

// ❌ Orphan TODO
// TODO: fix pagination later
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

```ts
// ✅ satisfies — validates all keys covered, no type widening
import { CampaignStatus } from '@/modules/campaign/types'

const CAMPAIGN_STATUS_TEXT = {
  draft: 'แบบร่าง',
  active: 'กำลังใช้งาน',
  ended: 'สิ้นสุดแล้ว',
} satisfies Record<CampaignStatus, string>
// TypeScript error if new CampaignStatus added but not handled ✅

// ❌ as — no exhaustiveness check; runtime undefined for missing keys
const CAMPAIGN_STATUS_TEXT = {
  draft: 'แบบร่าง',
  active: 'กำลังใช้งาน',
} as Record<CampaignStatus, string>  // 'ended' is missing, no error ❌
```

---

## #11 Testability

```ts
// ✅ Pure mapper — easy to unit test
export const mapCampaign = (data: any): ICampaign => ({
  id: data.id,
  code: data.code,
  status: data.status,
  name: data.name,
  isOpen: data.is_open,
})

// Test:
import { describe, it, expect } from 'vitest'
import { mapCampaign } from '../campaign.map'

describe('mapCampaign', () => {
  it('maps snake_case fields to camelCase', () => {
    const result = mapCampaign({ id: '1', code: 'C001', status: 'active', name: 'Test', is_open: true })
    expect(result).toEqual({ id: '1', code: 'C001', status: 'active', name: 'Test', isOpen: true })
  })
})

// ❌ Side effect mixed into mapper — untestable in isolation
export const mapAndSaveCampaign = async (data: any): Promise<ICampaign> => {
  const mapped = { id: data.id, name: data.name }
  await campaignCache.set(mapped.id, mapped) // side effect breaks unit test
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
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped data on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ id: '1' })
    const adapter = new OFetchAdapter(mockFetch, BASE_URL, '/campaigns')
    const result = await adapter.get('/1')
    expect(result.isOk).toBe(true)
  })
})
```

---

## #12 Debugging Friendly

```ts
// ✅ Surface error with context
const result = await campaignServiceV2.deleteMany(codes)
if (!result.isOk) {
  console.error('[CampaignDelete] Failed:', result.error)
  alertDialog.current?.show({
    color: 'orange',
    title: 'ลบแคมเปญไม่สำเร็จ',
    description: result.error?.message,
  })
  return
}

// ❌ Silent failure — user sees nothing, data is gone
const result = await campaignServiceV2.deleteMany(codes)
router.push(ROUTE_PATHS.manage.campaign.index()) // proceeds even if delete failed
```

```tsx
// ✅ Error boundary with useful message
if ($campaigns.isError) {
  return <ErrorState message="โหลดข้อมูลแคมเปญไม่สำเร็จ กรุณารีเฟรชหน้า" />
}

// ❌ Swallow query error — blank screen with no explanation
if ($campaigns.isError) return null
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

```tsx
// ✅ Functional setState — no stale closure, stable callback
function CampaignList() {
  const [selected, setSelected] = useState<string[]>([])

  const handleSelect = useCallback((code: string) => {
    setSelected(curr => [...curr, code])  // always latest state
  }, [])  // no deps needed

  const handleDeselect = useCallback((code: string) => {
    setSelected(curr => curr.filter(c => c !== code))
  }, [])

  return <Table onSelect={handleSelect} onDeselect={handleDeselect} />
}

// ❌ Direct setState — stale closure risk + forces useCallback deps
function CampaignList() {
  const [selected, setSelected] = useState<string[]>([])

  const handleSelect = useCallback((code: string) => {
    setSelected([...selected, code])  // stale if selected not in deps
  }, [selected])  // recreated every time selected changes ❌

  return <Table onSelect={handleSelect} />
}
```

```tsx
// ✅ Lazy initial state — expensive compute runs once only
function FilterPanel() {
  const [filters, setFilters] = useState(() => parseFiltersFromUrl(window.location.search))
  // parseFiltersFromUrl() called once on mount ✅
}

// ❌ Eager evaluation — runs on every render (even when ignored)
function FilterPanel() {
  const [filters, setFilters] = useState(parseFiltersFromUrl(window.location.search))
  // parseFiltersFromUrl() called on every render ❌
}
```
