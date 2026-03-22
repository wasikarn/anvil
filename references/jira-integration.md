# Jira Integration for dlc-* Skills

Shared Jira context injection for dlc-review, dlc-build, and dlc-debug.
All Jira phases are optional — if no Jira key detected, skip entirely.

---

## Detection & Fetch

### Detect Jira Key

Scan all `$ARGUMENTS` for standard Jira key pattern `[A-Z]+-\d+` (e.g. `PROJ-123`). Position-agnostic — the key can appear anywhere in the arguments.

- Match found → extract key, proceed with fetch
- No match → skip all Jira sections, proceed as if no ticket

### Fetch Ticket

Try in order (stop at first success):

1. **`issue-bootstrap` agent** (atlassian-pm plugin — optional) — if available, delegate entirely:
   pass the issue key, capture the structured `{bootstrap_context}` output block.
   Provides: issue + parent epic + all subtasks + linked issues in one pass — no further extraction needed.
2. **`mcp-atlassian`** → `mcp__mcp-atlassian__jira_get_issue` with the detected key (direct API fallback)
3. **Neither available** → warn user "Jira MCP not configured, skipping ticket context" → skip Jira sections

> **atlassian-pm detection:** `issue-bootstrap` is available when the `atlassian-pm` plugin is installed
> (it bundles `jira-cache-server` MCP server). If `issue-bootstrap` is not in the agent list, fall through to option 2.

If fetch fails (API error, ticket not found) → warn → skip Jira sections → proceed normally. Jira context is never blocking.

### Extract Fields

When using `mcp-atlassian` fallback (option 2), extract and summarize manually:

| Field | Source | Notes |
| --- | --- | --- |
| `summary` | Issue title | — |
| `description` | Issue body | Truncate to key info |
| `acceptance_criteria` | Parse from description | Look for "AC:", "Acceptance Criteria", checkbox lists `- [ ]` |
| `priority` | Issue priority field | Map to P0/P1/P2/P3 |
| `status` | Issue status | Current workflow state |
| `subtasks` | Subtask list | Keys + summaries only |
| `parent` | Parent link | Epic/story key if exists |
| `linked_issues` | Issue links | Type (blocks, relates-to) + key + summary |

When using `issue-bootstrap` (option 1), all fields above are already extracted and structured in the output block — skip manual extraction.

---

## dlc-review: AC Verification

**Phase 0.6: Ticket Understanding** (between Phase 0.1: PR Scope Assessment and Phase 1: Project Detection)

1. Fetch ticket per Detection & Fetch above
2. Summarize ticket context:
   - **Problem:** What issue does the ticket address?
   - **Value:** Why does this matter?
   - **Scope:** What's in/out of scope?
3. Parse AC into numbered checklist items
4. Map each AC to file(s) in the PR diff using this heuristic:
   - **Single-file AC** (e.g., "validate email format on input"): search changed files semantically for the behavior. If not found → `[Critical] AC not implemented`
   - **Multi-file AC** (e.g., "user can login"): map to all relevant layers (route + service + repo + test). Flag `[Critical] AC partially implemented` if any layer is missing from the diff.
   - **Architectural AC** (e.g., "domain layer must not import from infra"): map to CLAUDE.md or project architecture docs as evidence. Cannot be Critical if no concrete implementation was expected in this PR — flag as `[Warning] AC architectural — verify at integration review`
   - **Test coverage**: for every functional AC, confirm at least one test file covers it. No test → `[Critical] Missing test for AC`
5. Pass AC summary to Phase 2 teammate prompts — teammates should verify AC coverage in their review area
6. Include AC verification table in final output (Phase 4)

---

## dlc-build: Scope & Planning

**Phase 0, Step 2.5: Jira Context** (after Step 2: Classify Mode, before Step 3: Create Context Artifact)

1. Fetch ticket per Detection & Fetch above
2. Extract AC → each becomes a task item constraint for Phase 2 plan
3. Extract subtasks → map to plan structure if subtasks exist
4. Add to `dev-loop-context.md`:

   ```markdown
   ## Jira Ticket
   Key: PROJ-123
   Summary: {summary}
   Priority: {priority}
   Status: {status}

   ## Acceptance Criteria
   - [ ] AC1: {description}
   - [ ] AC2: {description}
   ```

5. **Phase 2 constraint:** Plan must address every AC — unaddressed AC is a plan gap, flag before proceeding
6. **Phase 5 constraint:** Assess must verify each AC has corresponding implementation + test — unverified AC = Critical finding

---

## dlc-debug: Bug Enrichment

**Phase 0, Step 1.5: Jira Context** (after Step 1: Detect Project, before Step 2: Classify Severity)

1. Fetch ticket per Detection & Fetch above
2. Enrich bug description with ticket details:
   - Reproduction steps (from description)
   - Expected vs actual behavior
   - Environment details
   - User-reported symptoms
3. Check linked issues → related bugs may share root cause — include in Investigator context
4. Use ticket priority to inform severity classification (Step 2):
   - Jira P0/P1 → suggest P0/P1 severity
   - Jira P2/P3 → suggest P2 severity
   - Lead still makes final classification based on actual impact
5. Add to `debug-context.md`:

   ```markdown
   ## Jira Ticket
   Key: PROJ-123
   Summary: {summary}
   Priority: {priority}

   ## Linked Issues
   - ABC-YYYY: {summary} (relates-to)
   - ABC-ZZZZ: {summary} (is-blocked-by)
   ```

6. Include Jira context in Investigator prompt (Phase 1) — helps narrow search area

---

## dlc-respond: Thread Prioritization

**Phase 0, Step 0.5: Jira Context** (after Step 1: Detect Project, before Step 2: Fetch Threads)

1. Fetch ticket per Detection & Fetch above
2. Extract AC — use to enrich thread severity:
   - Thread relates to an AC item → severity bump (🔵 Suggestion → 🟡 Important if AC-related)
   - Thread flagging missing AC implementation → treat as 🔴 Critical regardless of reviewer label
3. Add to `respond-context.md`:

   ```markdown
   ## Jira Ticket
   Key: PROJ-123
   Summary: {summary}
   Priority: {priority}

   ## Acceptance Criteria
   - [ ] AC1: {description}
   - [ ] AC2: {description}
   ```

4. Include AC context in Fixer prompts — helps Fixer understand business intent behind reviewer comments
5. **Jira context is informational only** — does not block Phase 0 if fetch fails
