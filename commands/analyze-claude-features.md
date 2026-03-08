# Analyze Claude Features

Use plan mode for this task. Before executing anything, present your full plan and wait for approval.

---

Before starting, check if the following sources are already available in your context or cache.
Fetch only what is missing — do not re-fetch sources already loaded.

**Sources:**

- <https://code.claude.com/docs/en/sub-agents.md>
- <https://code.claude.com/docs/en/agent-teams.md>
- <https://code.claude.com/docs/en/skills.md>
- <https://code.claude.com/docs/en/output-styles.md>
- <https://code.claude.com/docs/en/hooks-guide.md>
- <https://www.notion.so/Skill-Claude-BestPractice-31cff5ab8d4680429ecbc56504c6293c>

Then analyze what can be concretely applied or improved in this project.

---

## Phase 1 — Plan (present this before doing anything)

Before executing, outline:

1. Which sources need to be fetched vs. already in cache
2. Which project files you intend to read and why
3. What you expect to find in each step (hypothesis)
4. Any risks or ambiguities that need clarification upfront

Wait for approval before proceeding to Phase 2.

---

## Phase 2 — Execute (only after approval)

**Step 1 — Comprehend Sources**
For each source, extract: core concept, key capabilities, and intended use cases.

Checklist:

- [ ] sub-agents.md — concept, capabilities, use cases extracted
- [ ] agent-teams.md — concept, capabilities, use cases extracted
- [ ] skills.md — concept, capabilities, use cases extracted
- [ ] output-styles.md — concept, capabilities, use cases extracted
- [ ] hooks-guide.md — concept, capabilities, use cases extracted
- [ ] Notion BestPractice — concept, capabilities, use cases extracted

---

**Step 2 — Audit Project Structure (carefully)**
This project may have a large codebase. Do NOT assume or infer structure.

Checklist:

- [ ] Read CLAUDE.md — architecture, conventions, and declared constraints noted
- [ ] Verify top-level directory structure via listing
- [ ] Confirm tech stack from package.json / config files (not from assumption)
- [ ] Locate and review existing scripts, hooks, or automation files
- [ ] Check for CI/CD config files (.github/, Jenkinsfile, etc.)
- [ ] Note anything unconfirmed as [UNVERIFIED] — do not guess

---

**Step 3 — Identify Confirmed Context**
Before gap analysis, explicitly state only what is verified:

Checklist:

- [ ] Tech stack confirmed (language, framework, runtime versions)
- [ ] Project structure mapped (key directories and their roles)
- [ ] Existing workflows identified (scripts, hooks, CI/CD)
- [ ] Known pain points captured (from CLAUDE.md, README, or comments)
- [ ] All [UNVERIFIED] items listed with reason why they could not be confirmed

---

**Step 4 — Gap Analysis**
Compare each source's capabilities against confirmed context only.
Do NOT propose improvements based on assumed or unverified state.

Checklist:

- [ ] sub-agents — gaps vs. current project identified
- [ ] agent-teams — gaps vs. current project identified
- [ ] skills — gaps vs. current project identified
- [ ] output-styles — gaps vs. current project identified
- [ ] hooks — gaps vs. current project identified
- [ ] BestPractice — gaps vs. current project identified

---

**Step 5 — Opportunity Mapping**
For each confirmed gap, define: what to change, add, or automate — and which files/areas it affects.

Checklist:

- [ ] Each opportunity linked to a specific confirmed gap (not assumption)
- [ ] Affected files or areas identified for each opportunity
- [ ] No opportunity proposed from [UNVERIFIED] context without conditional flag

---

**Step 6 — Prioritize**
Score each opportunity: Impact (H/M/L) × Effort (H/M/L) → rank and justify.

Checklist:

- [ ] Every opportunity scored on Impact
- [ ] Every opportunity scored on Effort
- [ ] Final ranking justified with reasoning (not just scores)

---

**Step 7 — Recommend**
Propose a sequenced adoption plan: what to implement first, why, and what it unlocks next.
Flag any recommendation that depends on [UNVERIFIED] context as conditional.

Checklist:

- [ ] Adoption sequence defined with clear ordering rationale
- [ ] Dependencies between recommendations made explicit
- [ ] Conditional recommendations flagged where context is unverified
- [ ] Quick wins (Low Effort / High Impact) highlighted separately

---

## Output — Save as files (git-committable)

Write all output to `.claude/analysis/` directory with the following structure:

```text
.claude/
└── analysis/
    ├── README.md
    ├── 01-source-summaries.md
    ├── 02-project-context.md
    ├── 03-gap-analysis.md
    ├── 04-opportunities.md
    ├── 05-prioritization.md
    ├── 06-adoption-roadmap.md
    └── 07-unverified-items.md
```

**File requirements:**

- [ ] Each file has a `# Title`, `_Last updated: <date>_`, and `_Analyzed by: Claude Code_` header
- [ ] All tables use standard Markdown (renders correctly on GitHub/GitLab)
- [ ] `README.md` includes a summary of findings and links to each file
- [ ] No hardcoded absolute paths — all links are relative
- [ ] `07-unverified-items.md` clearly states what action is needed to resolve each item
