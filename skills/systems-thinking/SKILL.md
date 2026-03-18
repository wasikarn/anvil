---
name: systems-thinking
description: "Deep Systems Thinking analysis using Causal Loop Diagrams. Use for architecture decisions, major feature planning, recurring problem diagnosis, or evaluating new tools/processes. Teaches Claude to map systems, find feedback loops, predict bottleneck shifts, and apply Critical Thinking before deciding. Triggers: systems thinking, analyze system, bottleneck analysis, causal loop, second-order effects, why does this keep happening, think systemically, CLD."
---

# Systems Thinking Analysis

Think in systems, not symptoms. Map interconnections before intervening.

## When to Use

- Architecture decisions that affect multiple components
- Planning features that change workflow or team dynamics
- Problems that keep recurring despite fixes
- Introducing new tools or processes (including AI)
- Any change where "fixing one thing might break another"

## Step 1: Map the System

Before solving, understand.

**Identify components:**

- What are the key parts? (people, processes, tools, data flows)
- What are the boundaries? (what's inside vs outside the system)

**Identify connections:**

- What depends on what?
- What are the inputs/outputs of each component?
- Where does information flow? Where doesn't it?

Output format:

```text
[Component A] → feeds → [Component B] → triggers → [Component C]
                                       → also affects → [Component D]
```

## Step 2: Find Feedback Loops

Every system has loops. Find them before they find you.

**Reinforcing loops (R)** — amplify change (growth spirals or vicious cycles):

```text
[A ↑] →(+) [B ↑] →(+) [A ↑]   ← snowball effect
```

Example: AI Speed ↑ → Code Output ↑ → Expectations ↑ → Use AI More ↑

**Balancing loops (B)** — resist change (natural limits, quality gates):

```text
[A ↑] →(+) [B ↑] →(−) [A ↓]   ← self-correcting
```

Example: Code Output ↑ → Review Load ↑ → Throughput ↓

**Key questions:**

- Is this loop reinforcing or balancing?
- Is this loop working FOR us or AGAINST us?
- What would make a healthy loop turn vicious?

## Step 3: Predict Bottleneck Shifts

Fixing one bottleneck creates another. Always ask:

| Question | Why it matters |
| --- | --- |
| Where is the current bottleneck? | Know what you're solving |
| If we fix it, where does stress move? | Predict the next bottleneck |
| Is the new bottleneck worse than the current one? | Sometimes the cure is worse |
| Can the downstream system absorb the increased flow? | Capacity planning |

**The 7 common AI bottleneck shifts** (from CLD analysis):

1. Code faster → **Review** overloaded
2. More output → **Integration/Merge** jammed
3. Deliver faster → **Requirement clarity** drops → rework
4. Generate tests → **Test strategy** missing
5. More AI output → **Human validation** saturated
6. More suggestions → **Cognitive load** on decision-maker
7. AI-generated code → **Maintainability** degrades

## Step 4: Critical Thinking Checkpoint

Before acting on your analysis, apply these 6 checks:

1. **Question** — Why do we think this? What assumptions are we making?
2. **Reason** — Does the logic hold? Are there gaps in the causal chain?
3. **Fact vs Opinion** — What's evidence-based vs what's our interpretation?
4. **Bias** — What biases affect this analysis? Confirmation bias? Sunk cost?
5. **Evidence** — Is the data sufficient? What's missing?
6. **Judgment** — Would a skeptic agree? What would they challenge?

> AI speaks confidently even when wrong. The more convincing the analysis feels, the harder you should stress-test it.

## Step 5: Find Leverage Points

Not all interventions are equal. Prioritize by impact:

| Leverage (high → low) | Example |
| --- | --- |
| **Change the goal** | "ship fast" → "ship with confidence" |
| **Change the rules** | add quality gate before merge |
| **Change information flow** | make review load visible to the team |
| **Change the structure** | automate the bottleneck (CI/CD, auto-review) |
| **Change parameters** | adjust batch size, PR size limits |

**Principle:** Prefer interventions that strengthen balancing loops (quality gates) over those that accelerate reinforcing loops (more output).

## Output Template

When presenting analysis, use this structure:

```markdown
## System Map
[Components and connections]

## Feedback Loops
- R1: [name] — [description]
- B1: [name] — [description]

## Bottleneck Analysis
- Current: [where]
- After intervention: [where it shifts]
- Downstream capacity: [assessment]

## Critical Thinking
- Key assumption: [what we're assuming]
- Weakest link in reasoning: [where the logic is thinnest]
- Missing evidence: [what we don't know]

## Recommendation
- Leverage point: [what to change]
- Why this point: [reasoning]
- Risk if wrong: [what happens]
- How to verify: [feedback signal to watch]
```

## Key Principles

- **See the whole, not the parts** — problems are rarely where they appear
- **Respect feedback loops** — they're more powerful than any single intervention
- **Today's solution is tomorrow's problem** — always ask "then what?"
- **The system is not broken, it's perfectly designed for the results it gets** — change the design, not the symptoms
