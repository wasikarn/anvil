# Documentation Templates

Templates for API docs, README sections, and inline JSDoc/TSDoc.

## API Documentation Template

### Endpoint Section

```markdown
## METHOD /path/to/endpoint

Brief description of what this endpoint does.

**Auth:** Public | Required (type: bearer, api-key, session)

### Request

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | User display name |
| `email` | string | Yes | User email address |
| `role` | "admin" \| "user" | No | User role (default: "user") |

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |

**Path Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | User ID |

### Response

**200 OK:**

```json
{
  "data": {
    "id": "abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

**201 Created:**

```json
{
  "data": {
    "id": "abc123",
    "name": "John Doe"
  }
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid request body |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 429 | RATE_LIMIT | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

```text
(no content after this line - end of example)
```

### Full API Doc Template

```markdown
# API Reference

Base URL: `https://api.example.com/v1`

Authentication: All endpoints (except public) require a Bearer token in the `Authorization` header.

## Table of Contents

- [Authentication](#authentication)
  - [POST /auth/login](#post-authlogin)
  - [POST /auth/logout](#post-authlogout)
- [Users](#users)
  - [GET /users](#get-users)
  - [GET /users/:id](#get-usersid)
  - [POST /users](#post-users)

## Authentication

### POST /auth/login

Authenticate user and return access token.

[Full endpoint section here]

## Users

### GET /users

List all users with pagination.

[Full endpoint section here]
```

## README Section Templates

### Feature Section

```markdown
## Features

### Feature Name

Brief description of the feature.

**Usage:**

```bash
command --option value
```

**Example:**

```typescript
import { feature } from 'package';

const result = feature({ option: 'value' });
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `option` | string | - | Description |

**Configuration:**

Environment variables or config file settings.

```text
(no content after this line - end of example)
```

### Installation Section

```markdown
## Installation

### Prerequisites

- Node.js 18+
- npm 9+ or pnpm 8+

### Steps

1. Install dependencies:

```bash
npm install
```

1. Copy environment file:

```bash
cp .env.example .env
```

1. Configure environment:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/db
API_KEY=your-api-key
```

1. Run migrations:

```bash
npm run migrate
```

1. Start the server:

```bash
npm start
```

```text
(no content after this line - end of installation)
```

### Configuration Section

```markdown
## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `API_KEY` | Yes | - | External API key |
| `PORT` | No | 3000 | Server port |
| `LOG_LEVEL` | No | "info" | Logging level (debug, info, warn, error) |

### Config File

Configuration can also be set in `config/default.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "database": {
    "pool": 10
  }
}
```

```text
(no content after this line - end of config example)
```

## JSDoc/TSDoc Templates

### Function Documentation

```typescript
/**
 * Brief description of the function.
 *
 * Extended description with details about behavior,
 * edge cases, and usage notes.
 *
 * @param {Type} paramName - Description of the parameter
 * @param {Object} options - Configuration options
 * @param {string} options.field - Description of option
 * @returns {ReturnType} Description of return value
 * @throws {Error} When validation fails
 * @example
 * const result = functionName('value', { field: 'option' });
 * console.log(result); // expected output
 * @since 1.0.0
 */
export function functionName(paramName: Type, options: Options): ReturnType {
  // implementation
}
```

### Class Documentation

```typescript
/**
 * Brief description of the class.
 *
 * Extended description with usage notes and examples.
 *
 * @example
 * const instance = new ClassName('value');
 * instance.method();
 */
export class ClassName {
  /**
   * Brief description of the property.
   * @readonly
   */
  private readonly property: Type;

  /**
   * Create a new instance.
   * @param {Type} param - Description
   */
  constructor(param: Type) {
    this.property = param;
  }

  /**
   * Brief description of the method.
   * @param {Type} param - Description
   * @returns {ReturnType} Description
   * @throws {Error} When something fails
   */
  method(param: Type): ReturnType {
    // implementation
  }
}
```

### Type Documentation

```typescript
/**
 * Description of the type.
 *
 * @typedef {Object} TypeName
 * @property {string} field - Description
 * @property {number} [optionalField] - Optional field description
 */
export type TypeName = {
  field: string;
  optionalField?: number;
};

/**
 * Union type for status values.
 * @typedef {'active' | 'inactive' | 'pending'} Status
 */
export type Status = 'active' | 'inactive' | 'pending';
```

### Interface Documentation

```typescript
/**
 * Description of the interface.
 *
 * @interface InterfaceName
 * @property {string} field - Description
 * @property {number} [optionalField] - Optional field description
 */
export interface InterfaceName {
  field: string;
  optionalField?: number;
}
```

### Callback/Event Handler

```typescript
/**
 * Callback function type.
 *
 * @callback CallbackName
 * @param {Event} event - The event object
 * @param {Context} context - The execution context
 * @returns {void}
 * @example
 * const callback: CallbackName = (event, context) => {
 *   console.log(event.type);
 * };
 */
export type CallbackName = (event: Event, context: Context) => void;
```

### Generic Type

```typescript
/**
 * Generic container for async results.
 *
 * @template T - The type of the success value
 * @template E - The type of the error (default: Error)
 * @example
 * const result: Result<User> = await fetchUser('123');
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

## Style Matching

Before generating documentation, match the existing style:

1. **Read existing docs** (API.md, README.md, or source files)
2. **Note the style:**
   - Heading depth (## vs ###)
   - Code block language tags
   - Table format
   - Tone (formal vs conversational)
3. **Generate new docs** matching that style

## Common Patterns

### Express/Fastify Route

```typescript
// Route: GET /users/:id
// Auth: Required (bearer token)
// Handler: UserController.show
router.get('/users/:id', authMiddleware, controller.show);
```

### AdonisJS Route

```typescript
// Route: GET /users/:id
// Auth: Required (session)
// Handler: UsersController.show
Route.get('users/:id', 'UsersController.show').middleware('auth')
```

### NestJS Controller

```typescript
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserDto })
  findOne(@Param('id') id: string) {}
}
```
