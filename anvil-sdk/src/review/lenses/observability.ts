export const OBSERVABILITY_LENS = `
# Observability Review Lens

Inject into reviewer prompts when diff touches: logging, metrics, tracing, monitoring, or any new service/endpoint/background job.

\`\`\`text
OBSERVABILITY LENS (active for this review):

THRESHOLD: Report at confidence ≥75 unless marked Hard Rule.

STRUCTURED LOGGING (Hard Rule — flag when new logger calls added):
- Unstructured log message with interpolation: \`logger.info(\\\`User \${id} created\\\`)\`
  Fix: \`logger.info({ userId: id }, 'user created')\` — fields are queryable, message is constant
- Sensitive data in log fields: passwords, tokens, PII (email, phone, national ID), full request body
  Fix: allowlist logged fields; use \`redact\` option (pino) or manual field exclusion
- \`console.log\` / \`console.error\` in production code → replace with project logger
- Log level mismatch: expected errors logged as \`info\`, or debug noise logged as \`warn\` in hot paths
  Levels: \`error\` (action required), \`warn\` (degraded state), \`info\` (business event), \`debug\` (dev only)

CONTEXT PROPAGATION:
- New async operation (HTTP handler, queue consumer, cron job) without request/correlation ID in log context
  Pattern: set \`requestId\` on logger at entry point; all downstream calls inherit via AsyncLocalStorage or logger child
- Outbound HTTP call without forwarding \`X-Request-Id\` / \`traceparent\` header → trace breaks at service boundary
- Background job logs without job ID / attempt number → impossible to correlate logs across retries

ERROR OBSERVABILITY:
- Error caught and swallowed without incrementing error counter or alerting
  Pattern: \`metrics.increment('job.failed', { job: name }); logger.error({ err }, 'job failed')\`
- Exception boundary (try/catch at top level) not reporting to error tracking (Sentry, Datadog, etc.)
  when project uses such a service
- Error message logged without stack trace: \`logger.error(e.message)\` → loses root cause
  Fix: \`logger.error({ err: e }, 'context message')\` — pino/winston serialize \`err\` with stack

METRICS (flag when new endpoint or background job added):
- New endpoint with no latency/error rate instrumentation (if project uses metrics)
  Minimum: start timer at request entry, record histogram on response with status code label
- Counter without labels: \`metrics.increment('requests')\` → cannot break down by endpoint/status
  Fix: \`metrics.increment('http.requests', { method, route, status })\`
- Histogram without appropriate buckets for the domain
  (API latency: 10ms–10s; background job: 100ms–60s — mismatched buckets compress signal)
- Gauge for value that only grows → should be counter; gauge is for current-state values (queue depth, connections)

ALERTING COVERAGE (advisory — flag when no test or comment exists):
- Critical background job (payment processing, notification delivery) with no comment referencing
  an alert/runbook → silent failure in production goes undetected
- New failure mode introduced (new error type, new external dependency) without noting
  what observable signal indicates the failure
\`\`\`
`
