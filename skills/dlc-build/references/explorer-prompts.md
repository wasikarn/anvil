# Explorer Prompt Templates

Prompt templates for explorer teammates. Lead inserts project-specific values at `{placeholders}`.

## Explorer 1: Execution Paths

```text
You are exploring the codebase for a development task.

TASK: {task_description}
PROJECT: {project_name}
PROJECT HINTS: {project_hints}
BOOTSTRAP CONTEXT: {bootstrap_context}
ASSIGNED SCOPE: {assigned_files_or_dirs}
(Stay within your assigned scope — other explorers cover the rest to prevent overlap.)

YOUR FOCUS: Trace execution paths in the primary area this task will touch.

INSTRUCTIONS:
1. Find the entry point(s) for the area being modified
2. Trace the full request/response or event cycle
3. Document every function call, middleware, and hook in the path
4. Note patterns: naming conventions, error handling, validation
5. Identify reusable code that solves similar problems

OUTPUT FORMAT:
## Files Read
{list of files with line ranges}

## Findings
### Execution Paths
{findings with file:line for every claim}

### Patterns & Conventions
{findings with file:line for every claim}

### Reusable Code
{findings with file:line for every claim}

### Open Questions
{anything unclear that the plan phase should address}

Send your findings to the team lead when done.

TOKEN BUDGET:
- After reading 8+ files in this phase (count only files you read directly — not shared context injected by Lead): switch to header + structure overview only for files >300 lines
- Do not re-read files that Lead already sent as shared context in this prompt
- If you cannot complete your task within this budget, list unread files and explain what's missing

OBSERVATION MASKING:
After reading a file and extracting findings:
- Retain: file path, line refs, finding text, reasoning chain
- Discard: full file content from working memory
- Do not re-read a file you have already processed unless Lead explicitly requests it
```

## Explorer 2: Data Model & Dependencies

```text
You are exploring the codebase for a development task.

TASK: {task_description}
PROJECT: {project_name}
PROJECT HINTS: {project_hints}
BOOTSTRAP CONTEXT: {bootstrap_context}
ASSIGNED SCOPE: {assigned_files_or_dirs}
(Stay within your assigned scope — other explorers cover the rest to prevent overlap.)

YOUR FOCUS: Data model, dependencies, and coupling in the area this task touches.

INSTRUCTIONS:
1. Map the data model: schemas, types, interfaces, migrations
2. Identify upstream and downstream dependencies
3. Document coupling points — what would break if we change X?
4. Note constraints: unique indexes, foreign keys, validation rules
5. Check for existing tests that cover this area
6. DB performance risks: identify unbounded queries, missing indexes on query conditions, and tables with large data volumes — flag these as constraints in findings

OUTPUT FORMAT:
## Files Read
{list of files with line ranges}

## Findings
### Data Model
{findings with file:line for every claim}

### Dependencies & Coupling
{findings with file:line for every claim}

### Constraints & Risks
{findings with file:line for every claim}

### Open Questions
{anything unclear that the plan phase should address}

Send your findings to the team lead when done.

TOKEN BUDGET:
- After reading 8+ files in this phase (count only files you read directly — not shared context injected by Lead): switch to header + structure overview only for files >300 lines
- Do not re-read files that Lead already sent as shared context in this prompt
- If you cannot complete your task within this budget, list unread files and explain what's missing

OBSERVATION MASKING:
After reading a file and extracting findings:
- Retain: file path, line refs, finding text, reasoning chain
- Discard: full file content from working memory
- Do not re-read a file you have already processed unless Lead explicitly requests it
```

## Explorer 3: Reference Implementations

```text
You are exploring the codebase for a development task.

TASK: {task_description}
PROJECT: {project_name}
PROJECT HINTS: {project_hints}
BOOTSTRAP CONTEXT: {bootstrap_context}
ASSIGNED SCOPE: {assigned_files_or_dirs}
(Stay within your assigned scope — other explorers cover the rest to prevent overlap.)

YOUR FOCUS: Find similar implementations in the codebase that can serve as reference.

INSTRUCTIONS:
1. Search for existing code that solves a similar problem
2. Document the pattern used (architecture, data flow, error handling)
3. Note deviations from the norm — where did other implementations make different choices?
4. Identify test patterns used for similar features
5. List specific files to use as templates

OUTPUT FORMAT:
## Files Read
{list of files with line ranges}

## Findings
### Reference Implementations
{findings with file:line for every claim}

### Test Patterns
{findings with file:line for every claim}

### Template Files
{specific files recommended as implementation templates}

### Open Questions
{anything unclear that the plan phase should address}

Send your findings to the team lead when done.

TOKEN BUDGET:
- After reading 8+ files in this phase (count only files you read directly — not shared context injected by Lead): switch to header + structure overview only for files >300 lines
- Do not re-read files that Lead already sent as shared context in this prompt
- If you cannot complete your task within this budget, list unread files and explain what's missing

OBSERVATION MASKING:
After reading a file and extracting findings:
- Retain: file path, line refs, finding text, reasoning chain
- Discard: full file content from working memory
- Do not re-read a file you have already processed unless Lead explicitly requests it
```

## Lead Notes

When constructing explorer prompts:

1. Replace all `{placeholders}` with actual values
2. Insert project-specific `PROJECT HINTS` from CLAUDE.md conventions
3. Insert validate command from [phase-gates.md](phase-gates.md) project detection (for reference context)
4. Explorer 3 is optional — spawn only if similar existing features exist
5. **Assign non-overlapping scopes** — set `{assigned_files_or_dirs}` for each explorer. Example: Explorer 1 → `src/controllers/`, Explorer 2 → `src/models/ + migrations/`, Explorer 3 → `src/services/`. Prevents duplicate reads and conflicting findings.
6. All explorer findings are merged by lead into `{artifacts_dir}/research.md` — every section must cite file:line references
