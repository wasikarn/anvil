# 12-Point Review Checklist — tathep-ai-agent-python

For ✅/❌ code examples → [examples.md](examples.md)

**Severity:** 🔴 Critical (must fix) · 🟡 Important (should fix) · 🔵 Suggestion
**Format:** `[#N Aspect] file:line — issue → fix`

## Correctness & Safety

| # | Aspect |
| --- | -------- |
| 1 | **Functional Correctness** |
| 2 | **Shared Libs & Patterns** |

### #1 Functional Correctness

- All AC requirements implemented — map each AC to specific code → 🔴
- `None` handled before use (no AttributeError path) → 🔴
- Edge cases: empty list, missing keys in dict, expired/inactive states → 🔴
- Error paths return structured errors (`ErrorMessage` dataclass), not bare exceptions → 🔴
- Agent nodes return proper state updates or `Command` objects → 🔴

### #2 Shared Libs & Patterns

- `logger` from `shared.libs.logging.logger` used — not `print()` → 🔴
- `invoke_with_fallback()` for all production LLM calls — not raw `model.invoke()` → 🔴
- `get_model("provider/model")` for model instantiation — not direct constructor → 🔴
- `ErrorMessage` dataclass for structured agent errors (error_code, can_retry) → 🟡
- Existing shared tools used where applicable (`user_memory_tool`, `find_billboards_tool`) → 🟡
- Factory pattern for adapters (`AIVideoGeneratorFactory`, `ScraperFactory`) → 🟡

## Performance

| # | Aspect |
| --- | -------- |
| 3 | **N+1 Prevention** |

### #3 N+1 Prevention

- No query inside loop (N queries for N records) → 🔴
- SQLAlchemy batch operations (`insert().values([...])`) for bulk data → 🔴
- Independent async calls use `asyncio.gather()` or `Promise.all` equivalent — not sequential `await` → 🟡
- Pinecone/vector store batch upserts — not one-by-one → 🟡

## Maintainability

| # | Aspect |
| --- | -------- |
| 4 | **DRY & Simplicity** |
| 5 | **Flatten Structure** |
| 6 | **Small Function & SOLID** |
| 7 | **Elegance** |

### #4 DRY & Simplicity

- 3+ identical code blocks → extract to function/constant → 🟡
- No redundant conditions (`if x == True:` → `if x:`) → 🟡
- No premature abstraction for single-use logic → 🟡
- Simplest correct solution — no over-engineering → 🟡

### #5 Flatten Structure

- Max 1 nesting level — use early returns for all guard clauses → 🔴
- No nested ternaries → 🔴
- No callback hell → use async/await → 🔴
- Use `continue` for loop filtering instead of nested `if` → 🟡
- Replace 4+ branch `if-elif` chains with `dict` dispatch → 🟡
- Extract complex conditional blocks into named functions → 🟡

### #6 Small Function & SOLID

- Functions < 20 lines (ideally) → 🟡
- SRP: one function does one thing → 🟡
- **Route handler**: thin — validate → delegate to usecase → respond (no business logic) → 🔴
- **UseCase**: all business logic + error handling → 🔴
- **Repository**: data access only (SQLAlchemy QB) — no business logic → 🔴
- Agent `__init__` → model + tools binding only; `__main_node__` → orchestration logic → 🟡
- Parameters ≤ 4 (use dataclass/TypedDict if more) → 🟡

### #7 Elegance

- Code reads like prose — clear pipeline from input to output → 🟡
- Explicit > implicit (no clever tricks that obscure intent) → 🟡
- Consistent style throughout PR → 🟡
- No dead code (unreachable branches, unused variables, unused imports) → 🟡

## Developer Experience

| # | Aspect |
| --- | -------- |
| 8 | **Clear Naming** |
| 9 | **Documentation** |
| 10 | **Type Safety** |
| 11 | **Testability** |
| 12 | **Debugging Friendly** |

### #8 Clear Naming

- Booleans: `is_/has_/can_/should_` prefix (`is_active`, `has_permission`) → 🟡
- Functions: verb + noun (`get_user_by_id`, `create_conversation`) → 🟡
- Classes: PascalCase (`AdvertiserAgent`, `BrandAnalysisState`) → 🟡
- Constants: UPPER_SNAKE (`MAX_RETRIES`, `BRAND_EXTRACTION_SCHEMA`) → 🟡
- Enums: PascalCase with domain prefix (`CustomMessageTypeEnum`, `MessageRoleEnum`) → 🟡
- No abbreviations (`usr`, `msg`, `cfg`) → 🟡

### #9 Documentation

- Comments explain WHY, not WHAT (WHAT is readable from code) → 🔵
- No obvious comments (`# increment i`) → 🔵
- Tool docstrings describe intent for LLM (Args, Returns, description) → 🔴
- TODO linked to Jira ticket (`# TODO BEP-XXXX: ...`) → 🔵

### #10 Type Safety

- No `Any` type annotation → 🔴
- Full type hints on all function signatures (mypy enforces) → 🔴
- `TypedDict` for agent state, not plain `dict` → 🔴
- `Protocol` for duck typing interfaces → 🟡
- `list[str]` not `List[str]` (modern Python 3.12+ syntax) → 🟡
- `str | None` not `Optional[str]` (PEP 604 union syntax preferred) → 🟡
- Pydantic `BaseModel` for structured LLM output → 🟡

### #11 Testability

- Changed files have test coverage → 🔴
- Dependencies injectable — not hardcoded `import` at module level for side effects → 🟡
- Pure functions preferred — no hidden side effects → 🟡
- `pytest` fixtures for common test setup → 🟡
- `responses` or `unittest.mock` for HTTP mocking — no real API calls in tests → 🔴

### #12 Debugging Friendly

- Errors include context — what failed, what data (no bare `raise`) → 🟡
- No swallowed errors (`except: pass` or `except Exception: pass`) → 🔴
- `logger.error("message", extra={...})` with structured context → 🟡
- No silent failures (all async errors handled) → 🔴
- Specific exception types distinguish error categories → 🟡

## tathep-ai-agent-python Specific Checks

Always verify:

- [ ] **Forbidden patterns absent**: `Any` type, bare `except:`, `print()`, `import *`, hardcoded model names, raw `model.invoke()` in production
- [ ] **LLM resilience**: `invoke_with_fallback()` with fallback models for production agents
- [ ] **Type hints complete**: all function signatures typed (mypy strict)
- [ ] **Agent structure**: StateGraph nodes return proper state or Command objects
- [ ] **Tool docstrings**: `@tool` functions have LLM-readable docstrings with Args/Returns
- [ ] **Repository pattern**: SQLAlchemy Query Builder only — no ORM, no raw SQL strings
- [ ] **Error handling**: structured `ErrorMessage` for agent errors, specific exceptions elsewhere
- [ ] **Config**: environment vars via `shared/configs/` — not `os.getenv()` directly
- [ ] **Circular imports**: module-specific imports deferred to `__init__()` or function body
- [ ] **Formatting**: Black 88-char lines, `uv run black --check .` passes
- [ ] **Security**: no secrets in code, auth via `auth_required` dependency, no PII in logs

## Positive Signals

Look for these patterns when identifying Strengths:

- `invoke_with_fallback()` used for all LLM calls in production agents
- `TypedDict` state with clear field definitions
- Tool docstrings present and descriptive (LLM reads them)
- `get_model()` centralizes model configuration
- `Protocol` for duck typing interfaces
- pytest fixtures with `responses` mock for HTTP calls
