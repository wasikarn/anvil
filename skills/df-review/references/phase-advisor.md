# Phase Advisor: Cost-Intelligent Review

Advisor Strategy implementation for df-review. Uses fast executor (Sonnet/Haiku) for initial pass, escalates uncertain findings to Opus advisor for deep analysis.

**Pattern:** Haiku/Sonnet (Executor) → Confidence Gate → Opus (Advisor) → Final Report

**When to Use:**

- Large PRs (30+ files) where cost matters
- Budget-conscious review cycles
- Clear separation between "obvious" and "uncertain" findings
- Need frontier-level analysis only for critical/security issues

**Trade-off:** +10-20% latency vs -35% to -80% cost

## Detection

The `--advisor` flag triggers this mode:

```bash
/review 123 --advisor                    # Balanced mode (default)
/review 123 --advisor --mode=fast        # Haiku executor, Opus on security only
/review 123 --advisor --mode=conservative # Sonnet executor, lower threshold
```

## Execution Flow

### Phase 3-Advisor: Executor Initial Pass

Instead of spawning 3 standard reviewers, spawn:

**Executor Reviewers (Haiku or Sonnet depending on mode):**

- T1-Fast: Correctness & Security focus
- T2-Fast: Architecture & Performance focus
- T3-Fast: DX & Testing focus

Each executor outputs findings **with confidence scores**:

```typescript
interface Finding {
  file: string;
  line: number;
  severity: "Critical" | "Warning" | "Suggestion";
  category: string;
  message: string;
  confidence: number;  // 0.0 - 1.0
  rule: string;         // Which rule triggered
}

interface ReviewResult {
  findings: Finding[];
  requiresEscalation: boolean;
  escalationReasons: string[];
}
```

### Confidence Thresholds

| Mode | Executor Model | Threshold | Escalate On |
|------|------------------|-----------|-------------|
| fast | Haiku | 0.6 | Security patterns only |
| balanced | Sonnet | 0.7 | Security + Architecture + confidence < 0.7 |
| conservative | Sonnet | 0.8 | Any finding with confidence < 0.8 |

**Auto-escalate patterns (always go to advisor):**

- Security: `sql-injection`, `xss`, `auth-bypass`, `secrets`, `unsafe-eval`
- Architecture: `breaking-change`, `api-contract`, `circular-dependency`
- Complexity: Files with >500 lines changed

### Phase 4-Advisor: Advisor Consultation

For escalated findings, spawn **advisor-consultant** agent (Opus):

```yaml
name: advisor-consultant
description: "Expert advisor for uncertain code review findings. Provides deep analysis when executor confidence is low."
tools: Read, Grep
color: purple
effort: high
maxTurns: 10
disallowedTools: Edit, Write
```

**Advisor receives compressed context:**

- File path and line numbers
- Original finding (low confidence)
- Code snippet (summarized)
- Specific question requiring frontier reasoning

**Advisor returns:**

```typescript
interface AdvisorGuidance {
  verdict: "ACCEPT" | "REJECT" | "NEEDS_DISCUSSION";
  reasoning: string;
  suggestedFix?: string;
  severityAdjustment?: "UPGRADE" | "DOWNGRADE" | "UNCHANGED";
  confidence: number;
}
```

### Phase 5-Advisor: Synthesis

**review-consolidator** (Haiku) combines:

1. Executor findings with confidence >= threshold
2. Advisor guidance for escalated items
3. Formats final report per review-output-format

## Agent Prompt Modifications

### Executor Prompt Addition

Add to each fast reviewer prompt:

```text
CONFIDENCE SCORING (required):
Assign confidence 0.0-1.0 to each finding:
- 0.9-1.0: Clear violation, explicit pattern match
- 0.7-0.89: Likely issue, some uncertainty
- 0.5-0.69: Uncertain, needs second opinion
- <0.5: Do not report

ESCALATION CRITERIA:
Mark finding for advisor review if:
- confidence < ${THRESHOLD}
- Security category detected
- Architecture pattern unclear
- Complexity too high to assess quickly

Output format addition: Add | Confidence | Escalate? columns to findings table.
```

### Advisor Prompt

```text
You are an expert code review advisor. The executor has flagged uncertain findings requiring your expertise.

YOUR ROLE:
- Deeply analyze uncertain findings
- Provide verdict: ACCEPT (finding valid), REJECT (false positive), or NEEDS_DISCUSSION
- Suggest fixes when applicable
- Adjust severity if needed

RULES:
- You are READ-ONLY — do not modify files
- Be decisive — executor is waiting for your guidance
- Return structured JSON only

CONTEXT:
{compressed_diff}

UNCERTAIN FINDINGS FROM EXECUTOR:
{findings_requiring_escalation}

Respond with JSON only:
{
  "verdict": "ACCEPT|REJECT|NEEDS_DISCUSSION",
  "reasoning": "brief explanation",
  "suggestedFix": "code if applicable",
  "severityAdjustment": "UPGRADE|DOWNGRADE|UNCHANGED",
  "confidence": 0.0-1.0
}
```

## Cost Comparison

| PR Size | Standard (3×Opus) | Advisor (balanced) | Savings |
|---------|-------------------|-------------------|---------|
| 10 files | ~$4.50 | ~$1.50 | 67% |
| 30 files | ~$13.50 | ~$4.20 | 69% |
| 50 files | ~$22.50 | ~$4.50 | 80% |

Based on 20% escalation rate (typical)

## Integration with Existing Modes

| Flag Combination | Behavior |
|------------------|----------|
| `--advisor` only | Balanced mode: Sonnet executor, 0.7 threshold |
| `--advisor --mode=fast` | Haiku executor, security-only escalation |
| `--advisor --mode=conservative` | Sonnet executor, 0.8 threshold |
| `--advisor --quick` | 2 executors (T1+T2), no debate, advisor on uncertainty |
| `--advisor --full` | 3 executors + full debate, advisor supplements where needed |
| `--advisor --focused security` | Security specialist executor + advisor on all findings |

## Red Flags

| Problem | Solution |
|---------|----------|
| Escalation rate >40% | Lower threshold or use standard review |
| Missing critical bugs | Executor missing patterns → add to lens |
| Too slow | Use Haiku executor, batch advisor calls |
| Advisor context too long | Summarize diffs before sending |
| Inconsistent formatting | Haiku always formats final report |

## Fallback

If advisor-consultant unavailable:

1. Log warning: "Advisor mode unavailable, falling back to standard review"
2. Continue with standard 3-reviewer debate (Phase 3 normal flow)

## Success Metrics

Track in review artifacts:

- Escalation rate (target: 10-30%)
- Advisor verdict distribution (ACCEPT/REJECT/NEEDS_DISCUSSION)
- Cost savings vs standard review
- Quality score (post-merge bug rate)
