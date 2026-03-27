# AdonisJS Review Lens

Inject into reviewer prompts when diff touches: `app/controllers/`, `app/models/`, `app/validators/`, `app/services/`, `start/routes.ts`, or files using Lucid ORM / Vine / IoC decorators.

```text
ADONISJS LENS (active for this review):

HARD RULES (flag unconditionally — no confidence gate):
- Raw `process.env.FOO` → must use `env.get('FOO')` (Env module validates schema on boot)
- `db.rawQuery()` with string interpolation → parameterised binding only; SQL injection risk
- Response data returned without Vine/schema validation → validate at controller boundary always
- N+1 via Lucid: loop calling `model.related().load()` individually → `.preload()` at query time
- Transaction missing: multiple writes with no `trx` → data inconsistency on partial failure

LUCID ORM:
- Missing `.preload()` on relations accessed in loop → N+1 queries (use eager loading)
- `.firstOrFail()` when optional → `.first()` + explicit null check; don't swallow 404 vs null
- Soft deletes: querying without `.withTrashed()` when deleted records are relevant → silent data loss
- Missing `useTransaction(trx)` on related model operations inside a transaction → partial commit
- `Model.create()` called with raw user input without `$fill` / column whitelist → mass assignment

VINE / VALIDATION:
- Controller action reading `request.body()` or `request.input()` without Vine schema → validate first
- Vine schema not imported from `@vinejs/vine` → wrong package, validators won't run
- Schema defined inside route handler (not extracted) → rebuild on every request; move to `app/validators/`
- Missing `messages` on `vine.compile()` for user-facing endpoints → generic errors reach clients

IOC CONTAINER & DI:
- `new ServiceClass()` inside a controller or service → breaks IoC; use `@inject()` + constructor injection
- `app.make(ServiceClass)` called at module load time (top-level await) → race with container boot
- Circular dependency between two `@inject()` services → container throws at runtime; use lazy injection

HTTP CONTEXT & MIDDLEWARE:
- `ctx.auth.authenticate()` missing on protected routes → route accessible without login
- `ctx.bouncer.authorize()` missing where resource ownership is required → privilege escalation
- `ctx.request.ip()` used for rate-limiting without `trustProxy` set → spoofable behind load balancer
- Exception thrown outside an async context → not caught by AdonisJS global exception handler; wrap in `try/catch` or return response directly

ROUTING:
- Route group missing `.middleware()` call for auth-required endpoints → auth bypass
- Route parameters not validated (`request.param('id')`) → coerce to expected type before ORM query
- Missing `.as()` alias on named routes used in views/redirects → hard-coded strings break on rename

EXISTING (conf ≥75):
- Controller action doing business logic directly → extract to service; controllers should be thin
- Missing `response.created()` / correct HTTP status codes on resource creation (201 vs 200)
- Long-running work in controller without queue job → blocks HTTP worker thread

THRESHOLD: HARD RULE items → always. All others: conf ≥75.
```
