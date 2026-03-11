# Code Examples — tathep-ai-agent-python

Examples for rules that are project-specific or counter-intuitive.

---

## #1 Functional Correctness

```python
# ✅ None check before use + structured error
async def execute(self, user_code: str) -> ConversationOut:
    conversation = await self.repo.find_by_user_code(user_code)
    if conversation is None:
        raise ConversationNotFoundException(user_code)
    return ConversationOut.from_model(conversation)

# ❌ No None check — AttributeError at runtime
async def execute(self, user_code: str) -> ConversationOut:
    conversation = await self.repo.find_by_user_code(user_code)
    return ConversationOut.from_model(conversation)  # crashes if None!
```

```python
# ✅ Agent node returns proper Command with state update
def orchestrator_node(state: BrandAnalysisState) -> Command:
    decision = invoke_with_fallback(
        messages=[SystemMessage(content=PROMPT), HumanMessage(content=state["input"])],
        structured_output=OrchestratorDecision,
    )
    return Command(goto=[Send("worker", {"task": t}) for t in decision.tasks])

# ❌ Agent node returns bare dict without type — breaks StateGraph
def orchestrator_node(state: dict) -> dict:
    result = model.invoke(state["messages"])
    return {"output": result}  # untyped, no Command pattern
```

---

## #2 Shared Libs & Patterns

```python
# ✅ logger from shared — structured, filterable
from shared.libs.logging.logger import logger

logger.info("Creating conversation", extra={"user_code": user_code})
logger.error("Failed to create conversation", extra={"error": str(e), "user_code": user_code})

# ❌ print() — not structured, vanishes in production
print(f"Creating conversation for {user_code}")
print(f"Error: {e}")
```

```python
# ✅ invoke_with_fallback — resilient LLM call with automatic model failover
from shared.libs.invoke_with_fallback import invoke_with_fallback

result = invoke_with_fallback(
    messages=[SystemMessage(content=prompt), HumanMessage(content=user_input)],
    primary_model_name="openai/gpt-5-mini",
    fallback_models=["x-ai/grok-4.1-fast", "openai/gpt-4.1-mini"],
    structured_output=AnalysisResult,
    temperature=0.7,
)

# ❌ Raw model.invoke() — single point of failure, no fallback
from shared.libs.get_model import get_model

model = get_model("openai/gpt-5-mini")
result = model.invoke(messages)  # if this model is down, agent crashes
```

```python
# ✅ get_model() for model instantiation — centralized config
from shared.libs.get_model import get_model

model = get_model("openai/gpt-4.1-mini", temperature=0.7)
model_with_tools = model.bind_tools(tools_list)

# ❌ Direct constructor — bypasses config, can't switch providers
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4.1-mini", api_key="sk-...")  # hardcoded!
```

---

## #3 N+1 Prevention

```python
# ✅ Batch insert — 1 query total
from sqlalchemy import insert

with engine.connect() as conn:
    conn.execute(
        insert(billboard_table).values([
            {"name": b.name, "location": b.location}
            for b in billboards
        ])
    )
    conn.commit()

# ❌ N+1 — 1 insert per billboard
for billboard in billboards:
    with engine.connect() as conn:
        conn.execute(insert(billboard_table).values(name=billboard.name))
        conn.commit()
```

```python
# ✅ asyncio.gather for independent async calls
import asyncio

brand_result, competitor_result = await asyncio.gather(
    analyze_brand(brand_url),
    analyze_competitors(competitors),
)

# ❌ Sequential await — unnecessary wait
brand_result = await analyze_brand(brand_url)
competitor_result = await analyze_competitors(competitors)  # waits for brand first
```

---

## #4 DRY & Simplicity

```python
# ✅ Extract repeated validation
def validate_user_code(user_code: str) -> None:
    if not user_code or not user_code.strip():
        raise ValueError("user_code cannot be empty")

# ❌ Same validation duplicated across 3 use cases
# In CreateConversationUseCase:
if not user_code or not user_code.strip():
    raise ValueError("user_code cannot be empty")
# In GetConversationUseCase — exact copy:
if not user_code or not user_code.strip():
    raise ValueError("user_code cannot be empty")
```

---

## #5 Flatten Structure

```python
# ✅ Early returns — max 1 level
async def get_conversation(self, user_code: str, session_id: str) -> Conversation:
    conversation = await self.repo.find_by_session(user_code, session_id)
    if conversation is None:
        raise ConversationNotFoundException(session_id)
    if conversation.is_expired():
        raise ConversationExpiredException(session_id)
    return conversation

# ❌ Nested conditions
async def get_conversation(self, user_code: str, session_id: str) -> Conversation:
    conversation = await self.repo.find_by_session(user_code, session_id)
    if conversation is not None:
        if not conversation.is_expired():
            return conversation
        else:
            raise ConversationExpiredException(session_id)
    else:
        raise ConversationNotFoundException(session_id)
```

### Dict lookup for multi-branch conditions

❌ Bad:

```python
def get_status_color(status: str) -> str:
    if status == "active":
        return "green"
    elif status == "pending":
        return "yellow"
    elif status == "error":
        return "red"
    elif status == "cancelled":
        return "gray"
    else:
        return "black"
```

✅ Good:

```python
STATUS_COLORS: dict[str, str] = {
    "active": "green",
    "pending": "yellow",
    "error": "red",
    "cancelled": "gray",
}

def get_status_color(status: str) -> str:
    return STATUS_COLORS.get(status, "black")
```

### Extract complex conditional blocks

❌ Bad:

```python
async def process_conversation(conversation: Conversation) -> Response:
    if conversation.messages:
        if conversation.is_active():
            if conversation.has_valid_context():
                # ... processing logic
                pass
```

✅ Good:

```python
async def process_conversation(conversation: Conversation) -> Response:
    if not conversation.messages:
        raise EmptyConversationError(conversation.id)
    if not conversation.is_active():
        raise InactiveConversationError(conversation.id)
    if not conversation.has_valid_context():
        raise InvalidContextError(conversation.id)

    return await _execute_conversation_processing(conversation)
```

---

## #6 Small Function & SOLID

```python
# ✅ Route handler: thin — validate → delegate → respond
@router.post("/conversations")
async def create_conversation(
    request: CreateConversationRequest,
    user: AuthUser = Depends(auth_required),
) -> ConversationResponse:
    result = await create_conversation_usecase.execute(
        user_code=user.code,
        message=request.message,
    )
    return ConversationResponse.from_model(result)

# ❌ Business logic in route handler
@router.post("/conversations")
async def create_conversation(request: CreateConversationRequest):
    existing = await repo.find_by_user(request.user_code)
    if existing and not existing.is_expired():
        return existing
    conversation = Conversation(user_code=request.user_code)
    await repo.save(conversation)
    model = get_model("openai/gpt-4.1-mini")
    response = await model.invoke([...])  # all logic in handler!
    return response
```

```python
# ✅ Repository: data access only — SQLAlchemy Query Builder
class ConversationRepository:
    async def find_by_user_code(self, user_code: str) -> ConversationModel | None:
        with engine.connect() as conn:
            query = select(conversation_table).where(
                conversation_table.c.user_code == user_code
            )
            row = conn.execute(query).first()
            return ConversationModel.from_row(row) if row else None

# ❌ Business logic in repository
class ConversationRepository:
    async def find_active_by_user(self, user_code: str) -> ConversationModel | None:
        with engine.connect() as conn:
            row = conn.execute(select(conversation_table).where(...)).first()
            if row and row.created_at > datetime.utcnow() - timedelta(hours=24):
                return ConversationModel.from_row(row)  # business rule in repo!
            return None
```

---

## #7 Elegance

```python
# ✅ Clear pipeline — reads like prose
async def execute(self, user_code: str, message: str) -> ConversationModel:
    logger.info("Creating conversation", extra={"user_code": user_code})
    conversation = await self.repo.create(user_code=user_code)
    response = await invoke_with_fallback(
        messages=[SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=message)],
        primary_model_name="openai/gpt-5-mini",
        fallback_models=["openai/gpt-4.1-mini"],
    )
    await self.repo.add_message(conversation.id, role="assistant", content=response.content)
    return conversation

# ❌ Obscure — abbreviated names, no readability
async def exec(self, uc: str, m: str):
    c = await self.r.cr(uc=uc)
    res = await iwf(msgs=[SM(content=P), HM(content=m)], pmn="openai/gpt-5-mini")
    await self.r.am(c.id, "assistant", res.content)
    return c
```

---

## #8 Clear Naming

```python
# ✅ snake_case functions, descriptive names
async def get_user_by_code(user_code: str) -> User | None: ...
async def create_conversation_message(conversation_id: str, content: str) -> Message: ...
def is_conversation_expired(conversation: Conversation) -> bool: ...

# ❌ Vague names
async def get(code: str): ...      # get what?
async def process(data: dict): ... # process how?
def check(c) -> bool: ...          # check what?
```

```python
# ✅ Constants: UPPER_SNAKE
MAX_RETRIES = 3
BRAND_EXTRACTION_SCHEMA = {...}
DEFAULT_TEMPERATURE = 0.7

# ❌ Not obvious it's a constant
maxRetries = 3
schema = {...}
```

---

## #9 Documentation & Comments

```python
# ✅ Tool docstring for LLM — describes intent, args, returns
@tool
def find_billboards(query: str, max_results: int = 10) -> str:
    """Search for available billboards matching the query criteria.

    Args:
        query: Natural language description of desired billboard location or features
        max_results: Maximum number of results to return (default 10)

    Returns:
        JSON string of matching billboards with location, size, and pricing
    """
    return json.dumps(results)

# ❌ No docstring — LLM can't understand tool purpose
@tool
def find_billboards(query: str, max_results: int = 10) -> str:
    return json.dumps(results)
```

```python
# ✅ WHY comment — non-obvious circuit breaker config
# Firecrawl rate-limits at 100 req/min; circuit opens after 5 consecutive
# failures to prevent cascade. 30s recovery matches their rate limit window.
breaker = CircuitBreaker(fail_max=5, reset_timeout=30)

# ❌ WHAT comment — obvious from code
# Create a circuit breaker with max 5 failures
breaker = CircuitBreaker(fail_max=5, reset_timeout=30)
```

---

## #10 Type Safety

```python
# ✅ TypedDict for agent state — typed, IDE-friendly
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_code: str
    session_id: str

# ❌ Plain dict — no type checking, typo-prone
state = {"messages": [], "user_code": "abc", "sesion_id": "xyz"}  # typo undetected
```

```python
# ✅ Protocol for duck typing
from typing import Protocol

class Scraper(Protocol):
    async def scrape(self, url: str) -> str: ...

# ❌ No interface — any object accepted
def scrape_page(scraper, url):  # what methods does scraper need?
    return scraper.scrape(url)
```

```python
# ✅ Modern Python 3.12+ syntax
def get_user(user_id: str) -> User | None: ...
def process_items(items: list[str]) -> dict[str, int]: ...

# ❌ Legacy typing imports (unnecessary in 3.12+)
from typing import Optional, List, Dict
def get_user(user_id: str) -> Optional[User]: ...
def process_items(items: List[str]) -> Dict[str, int]: ...
```

---

## #11 Testability

```python
# ✅ pytest with fixtures and mocking
import pytest
from unittest.mock import AsyncMock, patch

@pytest.fixture
def mock_repo():
    repo = AsyncMock()
    repo.find_by_user_code.return_value = ConversationModel(id="conv-1", user_code="u1")
    return repo

async def test_get_conversation(mock_repo):
    usecase = GetConversationUseCase(repo=mock_repo)
    result = await usecase.execute("u1")
    assert result.id == "conv-1"
    mock_repo.find_by_user_code.assert_called_once_with("u1")

# ❌ No mocking — hits real DB
async def test_get_conversation():
    usecase = GetConversationUseCase()  # uses real repo
    result = await usecase.execute("u1")  # requires DB connection!
```

```python
# ✅ responses library for HTTP mocking
import responses

@responses.activate
def test_platform_api_call():
    responses.add(responses.GET, "https://api.example.com/users/1", json={"id": 1})
    result = platform_api.get_user(1)
    assert result["id"] == 1

# ❌ Real HTTP call in test — flaky, slow, requires network
def test_platform_api_call():
    result = platform_api.get_user(1)  # hits real API!
```

---

## #12 Debugging Friendly

```python
# ✅ Structured error with context
logger.error(
    "Failed to process conversation message",
    extra={
        "conversation_id": conversation.id,
        "user_code": user_code,
        "error": str(e),
        "error_type": type(e).__name__,
    },
)
raise ConversationProcessingError(conversation.id, str(e))

# ❌ Swallowed error — invisible failure
try:
    await self.repo.save(conversation)
except Exception:
    pass  # silent! no log, no rethrow
```

```python
# ✅ Specific exception types
class ConversationNotFoundException(Exception):
    def __init__(self, session_id: str):
        super().__init__(f"Conversation not found: {session_id}")
        self.session_id = session_id

class ConversationExpiredException(Exception):
    def __init__(self, session_id: str):
        super().__init__(f"Conversation expired: {session_id}")

# ❌ Generic exception — no actionable info
raise Exception("Something went wrong")
raise ValueError("Error")
```

---

## LangGraph Patterns (tathep-ai-agent-python specific)

```python
# ✅ StateGraph with typed state + Command/Send for parallel dispatch
from langgraph.graph import StateGraph, START
from langgraph.types import Command, Send

class BrandAnalysisState(TypedDict):
    input: str
    brand_result: BrandResult | None
    competitor_results: list[CompetitorResult]

def orchestrator(state: BrandAnalysisState) -> Command:
    decision = invoke_with_fallback(
        messages=[...],
        structured_output=OrchestratorDecision,
    )
    return Command(goto=[
        Send("brand_worker", {"task": "analyze_brand"}),
        Send("competitor_worker", {"task": "analyze_competitors"}),
    ])

graph = StateGraph(BrandAnalysisState)
graph.add_node("orchestrator", orchestrator)
graph.add_edge(START, "orchestrator")

# ❌ Untyped state + no orchestration pattern
graph = StateGraph(dict)  # untyped!
graph.add_node("do_everything", lambda s: {"result": model.invoke(s["input"])})
```

```python
# ✅ Structured output with Pydantic
from pydantic import BaseModel

class AnalysisResult(BaseModel):
    summary: str
    confidence: float
    recommendations: list[str]

result = invoke_with_fallback(
    messages=[...],
    structured_output=AnalysisResult,
)
# result is typed AnalysisResult, IDE autocomplete works

# ❌ Unstructured output — no validation, no type safety
result = model.invoke(messages)
data = json.loads(result.content)  # might fail, no schema validation
summary = data.get("summary", "")  # no guarantee keys exist
```
