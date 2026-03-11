# the-api

- [the-api](#the-api)
  - [Examples](#examples)
    - [Request and response](#request-and-response)
    - [DB + CRUD example](#db--crud-example)
      - [CRUD operations](#crud-operations)
        - [Create](#create)
        - [Update](#update)
        - [Get all](#get-all)
        - [Get one](#get-one)
        - [Delete](#delete)
      - [Query parameters for GET all](#query-parameters-for-get-all)
    - [Validation example](#validation-example)
    - [Field rules example](#field-rules-example)
    - [Permissions example](#permissions-example)
    - [Error example](#error-example)
  - [.env](#env)
  - [Response structure](#response-structure)
    - [Fields Description](#fields-description)
  - [Middlewares](#middlewares)
    - [logs](#logs)
    - [cors](#cors)
    - [csrf](#csrf)
    - [body-limit](#body-limit)
    - [compress](#compress)
    - [etag](#etag)
    - [errors](#errors)
      - [User-defined error](#user-defined-error)
      - [User-defined error with additional information](#user-defined-error-with-additional-information)
      - [Error with meta information](#error-with-meta-information)
      - [404 Not Found](#404-not-found)
      - [500 Internal Server Error](#500-internal-server-error)
      - [Status middleware](#status-middleware)
  - [Routes](#routes)
    - [Using Routings](#using-routings)
    - [Get route](#get-route)
    - [Post route](#post-route)
    - [Patch route](#patch-route)
    - [Delete route](#delete-route)
  - [TestClient For Integration Tests](#testclient-for-integration-tests)

## Examples

```typescript
import { Routings, TheAPI } from 'the-api';

const router = new Routings();

router.get('/data/:id', async (c) => { // hono routing
  const { id } = c.req.param();        // get route parameter
  c.set('result', { id, foo: 'bar' }); // set response result
});

const theAPI = new TheAPI({ routings: [router] });

await theAPI.up(); // use with node
// ...or use with bun
// export default await theAPI.upBun();
```

### Request and response

```
curl http://localhost:7788/data/123
```

```json
{
    "result": {
        "id": "123",
        "foo": "bar"
    },
    "error": false,
    "requestTime": 4,
    "serverTime": "2026-03-05T13:47:54.709Z"
}
```

### DB + CRUD example

After starting the server with files from the example, you can perform CRUD operations on `messages`. See [CRUD operations](#crud-operations) section for examples. For GET all, you can also use query parameters described in [Query parameters for GET all](#query-parameters-for-get-all) section.

- You need to have PostgreSQL running and `the-api` installed.
- Then, create `.env`, `./migrations/20260305134700_create_messages_table.ts` and `./index.ts` files with the following content:

**.env**

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
```

**./migrations/20260305134700_create_messages_table.ts**

```typescript
export const up = (knex) => knex.schema
  .createTable('messages', (table) => {
    table.increments('id').primary();
    table.timestamp('timeCreated').defaultTo(knex.fn.now());
    table.timestamp('timeUpdated');
    table.integer('warningLevel');
    table.string('body').notNullable();
  });

export const down = (knex) => knex.schema
  .dropTable('messages');
```

**./index.ts**

```typescript
import { Routings, TheAPI } from 'the-api';

const router = new Routings({ migrationDirs: ['./migrations'] });

router.crud({ table: 'messages' });

const theAPI = new TheAPI({ routings: [router] });

await theAPI.up();
```

- If you're using Node.js, check that you have `"type": "module"` in your `package.json` and start your project with `node --env-file=.env index.js`.
- If you're using Deno, start with `deno run --allow-net --allow-env --allow-read index.ts`.
- If you're using Bun, just start with `bun index.ts`.

#### CRUD operations

##### Create

`curl -X POST http://localhost:7788/messages -H "Content-Type: application/json" -d '{"warningLevel": 2, "body": "test message"}'`

```json
{
    "result": {
        "id": 1,
        "timeCreated": "2026-03-06T12:52:43.568Z",
        "timeUpdated": null,
        "warningLevel": 2,
        "body": "test message"
    },
    "error": false,
    "requestTime": 34,
    "serverTime": "2026-03-06T12:52:43.571Z"
}
```

##### Update

`curl -X PATCH http://localhost:7788/messages/1 -H "Content-Type: application/json" -d '{"warningLevel": 3}'`

```json
{
    "result": {
        "id": 1,
        "timeCreated": "2026-03-06T12:52:43.568Z",
        "timeUpdated": "2026-03-06T12:52:47.350Z",
        "warningLevel": 3,
        "body": "test message"
    },
    "error": false,
    "requestTime": 36,
    "serverTime": "2026-03-06T12:52:47.376Z"
}
```

##### Get all

`curl http://localhost:7788/messages`

```json
{
    "result": [
        {
            "id": 1,
            "timeCreated": "2026-03-06T12:52:43.568Z",
            "timeUpdated": "2026-03-06T12:52:47.350Z",
            "warningLevel": 3,
            "body": "test message"
        }
    ],
    "meta": {
        "total": 1,
        "limit": 0,
        "skip": 0,
        "page": 1,
        "pages": 1,
        "isFirstPage": true,
        "isLastPage": true
    },
    "error": false,
    "requestTime": 6,
    "serverTime": "2026-03-06T12:52:54.800Z"
}
```

##### Get one

`curl http://localhost:7788/messages/1`

```json
{
    "result": {
        "id": 1,
        "timeCreated": "2026-03-06T12:52:43.568Z",
        "timeUpdated": "2026-03-06T12:52:47.350Z",
        "warningLevel": 3,
        "body": "test message"
    },
    "error": false,
    "requestTime": 16,
    "serverTime": "2026-03-06T12:53:03.442Z"
}
```

##### Delete

`curl -X DELETE http://localhost:7788/messages/1`

```json
{
    "result": {
        "ok": true
    },
    "meta": {
        "countDeleted": 1
    },
    "error": false,
    "requestTime": 12,
    "serverTime": "2026-03-06T12:53:16.420Z"
}
```

#### Query parameters for GET all

| Parameter | Description | Example |
| --- | --- | --- |
| `_sort` | Sort by fields (`-field` for DESC, `random()` allowed) | `?_sort=-timeCreated,warningLevel` |
| `_limit` | Limit number of records | `?_limit=20` |
| `_page` | Page number (1-based) | `?_page=2&_limit=20` |
| `_skip` | Skip records | `?_skip=10&_limit=20` |
| `_unlimited` | Return all records (requires `CAN_GET_UNLIMITED=true`) | `?_unlimited=true` |
| `_after` | Cursor pagination (works with `_sort` + `_limit`) | `?_sort=-timeCreated&_limit=20&_after=2026-03-06T12:52:43.568Z` |
| `_fields` | Return only selected fields | `?_fields=id,warningLevel,body` |
| `_join` | Include `joinOnDemand` relations | `?_join=author,comments` |
| `_search` | Full-text/trigram search (when `searchFields` configured) | `?_search=test` |
| `_lang` | Translate fields via `langs` table | `?_lang=de` |
| `<field>` | Exact match (`IN` if repeated or array) | `?warningLevel=3` |
| `<field>~` | Case-insensitive `LIKE` (`ilike`) for string fields | `?body~=%test%` |
| `<field>!` | Not equal (`NOT IN` for array/repeated values) | `?warningLevel!=1` |
| `_null_<field>` | `IS NULL` filter (for nullable columns) | `?_null_timeUpdated=1` |
| `_not_null_<field>` | `IS NOT NULL` filter (for nullable columns) | `?_not_null_timeUpdated=1` |
| `_from_<field>` | Range lower bound (`>=`) for non-boolean columns | `?_from_warningLevel=2` |
| `_to_<field>` | Range upper bound (`<=`) for non-boolean columns | `?_to_warningLevel=3` |
| `_in_<field>` | `IN` from JSON array for non-boolean columns | `?_in_id=[1,2,3]` |
| `_not_in_<field>` | `NOT IN` from JSON array for non-boolean columns | `?_not_in_id=[4,5]` |


### Validation example

`router.crud({ table: 'messages' })` auto-builds validation from DB schema:
- `params.id` type is inferred from primary key type.
- `query._sort` accepts only table fields.
- `body.post`/`body.patch` are inferred from table columns.
- `required: true` for `POST` is inferred from `NOT NULL` columns without default.
- simple `CHECK` constraints (`>`, `>=`, `<`, `<=`, `IN`) are mapped to `min`, `max`, `enum`.

```typescript
router.crud({ table: 'messages' });
```

Custom validation can override only part of schema:

```typescript
router.crud({
  table: 'messages',
  validation: {
    body: {
      post: {
        warningLevel: { type: 'number', min: 1, max: 3 },
        body: { type: 'string', required: true },
      },
    },
  },
});
```

Disable all validation or only selected sections:

```typescript
router.crud({ table: 'messages', validation: {} });
router.crud({
  table: 'messages',
  validation: { params: {} },
});
```

`body.post` and `body.patch` can be functions:

```typescript
router.crud({
  table: 'messages',
  validation: {
    body: {
      post: (c, next) => ({
        warningLevel: { type: 'number', min: 0, max: 2 },
        body: { type: 'string', required: true },
      }),
      patch: (c, next) => ({
        validate: (value) => true,
      }),
    },
  },
});
```

Zod integration example:
https://github.com/the-api/the-api-validators-zod

### Field rules example

`fieldRules` is the only supported structure for field-level access configuration.

```js
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from 'the-api';

roles.init({
  root: ['*'],
  admin: ['users.getFullInfo', 'users.editEmail'],
  registered: ['users.getViews'],
  owner: ['users.getFullInfo'], // virtual owner permissions
});

const router = new Routings();

router.crud({
  table: 'users',

  fieldRules: {
    hidden: ['password', 'salt'], // always hidden
    readOnly: ['emailVerified'],  // not writable via POST/PATCH
    visibleFor: {
      'users.getFullInfo': ['email', 'phone', 'timeCreated'],
      'users.getViews': ['views'],
    },
    editableFor: {
      'users.editEmail': ['email'],
    },
  },
});

const theAPI = new TheAPI({ roles, routings: [router] });
```

How `fieldRules` works:
- `hidden`: fields are removed from response by default.
- `readOnly`: fields are filtered out from incoming `POST`/`PATCH` payloads.
- `hidden` fields are always added to read-only set.
- `visibleFor`: permission -> fields mapping for showing hidden fields.
- owner visibility is supported: if the record belongs to current user (`userId` by default), owner permissions are used for owner-view rules.

Notes:
- field-level behavior is configured only via `fieldRules`.
- If `readOnly` is not provided, default readonly fields are used: `id`, `timeCreated`, `timeUpdated`, `timeDeleted`, `isDeleted`.

### Permissions example

```js
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from 'the-api';

roles.init({
  root: ['*'], // all permissions
  admin: [
    '_.registered',       // nested permissions: all permissions of registered role
    'users.getFullInfo',  // get full info of users
    'users.editEmail',    // edit email
    'testNews.*'          // all permissions for testNews
  ],
  registered: ['testNews.get', 'users.get'], // only get permissions for testNews and users
  owner: ['users.getFullInfo', 'users.editEmail'], // virtual role, resolved per record
});

const router = new Routings({ migrationDirs: ['./tests/migrations'] });

router.crud({
  table: 'testNews',

  permissions: {
    methods: ['POST', 'PATCH', 'DELETE'], // explicit protection for selected CRUD methods
    owner: ['testNews.getFullInfo'], // explicit owner permissions for this CRUD
  },
});

const theAPI = new TheAPI({ roles, routings: [router] });
```

How `permissions` works:
- `methods`: enables route-level role check for selected CRUD methods.
- `methods` accepts `['GET', 'POST', 'PATCH', 'DELETE']` or `['*']` (uppercase).
- Mapping to routes:
  - `GET` protects both `/<prefix|table>` and `/<prefix|table>/:id`
  - `POST` protects only `/<prefix|table>`
  - `PATCH` and `DELETE` protect `/<prefix|table>/:id`
- If `permissions.methods` is not provided, methods are inferred automatically from role permissions:
  - the system scans all role values and finds `<prefix|table>.<method>` and `<prefix|table>.*`
  - example: role permission `users.delete` -> inferred `methods: ['DELETE']`
  - if no matching permissions exist, method-level protection is not added
- If `permissions.methods` is provided, it overrides auto-inference.
- `permissions.owner`: owner-specific permissions for field visibility rules.
  - If omitted, and roles service exists, owner permissions are resolved from role name `owner`.
- field visibility/editability rules are configured in `fieldRules` (`visibleFor`, `editableFor`).

### Error example

```
curl http://localhost:7788/d
```

```json
{
    "result": {
        "error": true,
        "code": 21,
        "status": 404,
        "description": "Not found",
        "name": "NOT_FOUND",
        "additional": []
    },
    "error": true,
    "requestTime": 2,
    "serverTime": "2026-03-05T13:48:42.543Z"
}
```

## .env

PORT=3000 (default 7788)

## Response structure

example:

```javascript
{
  result: {},
  relations: {},
  meta: {},
  error: false,
  requestTime: 2,
  serverTime: "2024-05-18T10:39:49.795Z",
  logId: "3n23rp20",
}
```

### Fields Description

- `result`: API response result, set with `c.set('result', ...)`.
- `relations`: Related objects associated with the main object.
- `meta`: API response metadata (e.g., page number, total pages), set with `c.set('meta', ...)`.
- `error`: Error flag (true/false) indicating if there was an error.
- `requestTime`: Time spent on the server to process the request, in milliseconds.
- `serverTime`: Current server time.
- `logId`: Request's log ID (used in `logs` middleware).

## Middlewares

### logs

`logs` middleware logs all requests and responses with unique request id, method, path, time on server, log information

data and time, unique request id, method, path, time on server, log information

each request starts with [begin] and ends with [end]

after begin you can see information about request

The following keys will mark as hidden: 'password', 'token', 'refresh', 'authorization'

you can use `c.var.log()` to add any info to logs

```javascript
import { Routings, TheAPI, middlewares } from 'the-api';

const router = new Routings();

router.get('/data/:id', async (c) => {
  c.var.log(c.req.param());
  c.set('result', { foo: 'bar' });
});

const theAPI = new TheAPI({
  routings: [
    middlewares.logs, // logs middleware
    router,
  ]
});

await theAPI.up();
```

```
curl http://localhost:7788/data/123
```

Output:

```
[2026-03-05T15:33:14.727Z] [j9szsmhn] [GET] [/data/123] [1] [begin]
[2026-03-05T15:33:14.727Z] [j9szsmhn] [GET] [/data/123] [1] {"headers":{"host":"localhost:7788","user-agent":"curl/7.68.0","accept":"*/*"},"query":{},"body":"","method":"GET","path":"/data/123"}
[2026-03-05T15:33:14.728Z] [j9szsmhn] [GET] [/data/123] [2] params: [object Object]
[2026-03-05T15:33:14.728Z] [j9szsmhn] [GET] [/data/123] [2] {"foo":"bar"}
[2026-03-05T15:33:14.728Z] [j9szsmhn] [GET] [/data/123] [2] [end]
```

### cors

`cors` is re-exported from `hono/cors`.

Docs: https://hono.dev/docs/middleware/builtin/cors

If you need to enable CORS for all methods on all routes, use `*`:

```typescript
import { Routings, TheAPI, cors } from 'the-api';

const router = new Routings();

router.get('/data', async (c) => {
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({
  routings: [router],
});

theAPI.app.use('*', cors());

await theAPI.up();
```

### csrf

`csrf` is re-exported from `hono/csrf`.

Docs: https://hono.dev/docs/middleware/builtin/csrf

If you need CSRF protection for all methods on all routes, use `*`:

```typescript
import { Routings, TheAPI, csrf } from 'the-api';

const router = new Routings();

router.post('/posts', async (c) => {
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({
  routings: [router],
});

theAPI.app.use('*', csrf());

await theAPI.up();
```

If you need to allow requests from a specific origin:

```typescript
import { Routings, TheAPI, csrf } from 'the-api';

const router = new Routings();

router.post('/posts', async (c) => {
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({
  routings: [router],
});

theAPI.app.use('*', csrf({ origin: 'https://app.example.com' }));

await theAPI.up();
```

### body-limit

`bodyLimit` is based on `hono/body-limit`.

Docs: https://hono.dev/docs/middleware/builtin/body-limit

If you need to limit request body size for all methods on all routes, use `*`:

```typescript
import { Routings, TheAPI, bodyLimit } from 'the-api';

const router = new Routings();

router.post('/upload', async (c) => {
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({
  routings: [router],
});

theAPI.app.use('*', bodyLimit({ maxSize: 1024 * 1024 }));

await theAPI.up();
```

### compress

`compress` is re-exported from `hono/compress`.

Docs: https://hono.dev/docs/middleware/builtin/compress

If you need response compression for all methods on all routes, use `*`:

```typescript
import { Routings, TheAPI, compress } from 'the-api';

const router = new Routings();

router.get('/data', async (c) => {
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({
  routings: [router],
});

theAPI.app.use('*', compress());

await theAPI.up();
```

### etag

`etag` is re-exported from `hono/etag`.

Docs: https://hono.dev/docs/middleware/builtin/etag

If you need ETag headers for all methods on all routes, use `*`:

```typescript
import { Routings, TheAPI, etag } from 'the-api';

const router = new Routings();

router.get('/data', async (c) => {
  c.set('result', { ok: true });
});

const theAPI = new TheAPI({
  routings: [router],
});

theAPI.app.use('*', etag());

await theAPI.up();
```

### errors

Every exception generates error response with `error` flag set to `true`

Also, error response contains code, status, main message, stack and `additional`.
`additional` is always an array of objects with at least `message`.

```javascript
import { Routings, TheAPI, middlewares } from 'the-api';

const router = new Routings();

router.errors({ // set user-defined errors
  USER_DEFINED_ERROR: {
    code: 55,
    status: 403,
    description: 'user defined error description',
  },
});

router.get('/error', async (c) => {
  throw new Error('USER_DEFINED_ERROR'); // throw user-defined error
});

router.get('/additional', async (c) => { // user-defined with additional information
    throw new Error('USER_DEFINED_ERROR: additional information');
});

const theAPI = new TheAPI({
  routings: [
    middlewares.errors, // errors middleware
    router,
  ]
});

await theAPI.up();
```

#### User-defined error

```
curl http://localhost:7788/error
```

Output:

```
{
    "result": {
        "code": 55,
        "status": 403,
        "description": "user defined error description",
        "name": "USER_DEFINED_ERROR",
        "additional": [],
        "stack": "Error: USER_DEFINED_ERROR\n    at ...stack trace...",
        "error": true
    },
    "error": true,
    "serverTime": "2026-03-05T15:48:28.369Z"
}
```

#### User-defined error with additional information

```
curl http://localhost:7788/additional
```

Output:

```
{
    "result": {
        "code": 55,
        "status": 403,
        "description": "user defined error description",
        "name": "USER_DEFINED_ERROR",
        "additional": [{ "message": "additional information" }],
        "stack": "Error: USER_DEFINED_ERROR\n    at ...stack trace...",
        "error": true
    },
    "error": true,
    "serverTime": "2026-03-05T15:48:28.369Z"
}
```

#### Error with meta information

```typescript
router.get('/meta', async (c: any) => {
  c.set('meta', { x: 3 });
  throw new Error('error message');
});
```

```javascript
{
  result: {
    code: 11,
    status: 500,
    description: "An unexpected error occurred",
    message: "error message",
    additional: [],
    stack: "...stack...",
    error: true,
  },
  meta: {
    x: 3,
  },
  error: true,
  requestTime: 1,
  serverTime: "2024-05-18T08:17:56.929Z",
  logId: "06zqxkyb",
}
```

#### 404 Not Found

```
curl http://localhost:7788/not-found
```

```javascript
{
  result: {
    code: 21,
    status: 404,
    description: "Not found",
    message: "NOT_FOUND",
    additional: [],
    error: true,
  },
  error: true,
  requestTime: 0,
  serverTime: "2024-05-18T16:56:21.501Z",
}
```

#### 500 Internal Server Error

```javascript
{
  result: {
    code: 11,
    status: 500,
    description: "An unexpected error occurred",
    message: "error message",
    additional: [],
    stack: "...stack...",
    error: true,
  },
  error: true,
  requestTime: 1,
  serverTime: "2024-05-18T08:17:56.929Z",
  logId: "06zqxkyb",
}
```

#### Status middleware

`GET /status`

```javascript
{
  result: {
    ok: 1,
  },
  error: false,
  requestTime: 1,
  serverTime: "2024-05-18T08:17:56.929Z",
  logId: "06zqxkyb",
}
```

## Routes

All like in [Hono Routing](https://hono.dev/api/routing), but you can set response result and response metadata the following way:

c.set('result', ...)

c.set('meta', ...)

### Using Routings

```typescript
import { Routings, TheAPI } from 'the-api';

const router = new Routings();

// your routing rules here

const theAPI = new TheAPI({ routings: [router] });
export default theAPI.up();
```

### Get route

```typescript
const router = new Routings();

router.get('data/:id', async (c: Context, n: Next) => {
  await n();
  c.set('result', {...c.var.result, e11: 'Hi11'});
});

router.get('data/:id', async (c: Context) => {
  c.set('result', {e22: 'Hi22', ...c.req.param()});
});

const theAPI = new TheAPI({ routings: [router] });
export default theAPI.up();
```

`GET /data/12`

```javascript
{
  result: {
    e22: "Hi22",
    id: "12",
    e11: "Hi11",
  },
  requestTime: 2,
  serverTime: "2024-05-18T14:07:12.459Z",
}
```

### Post route

router.post('/post', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', body);
});

### Patch route

router.patch('/patch/:id', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', {...c.req.param(), ...body});
});

### Delete route

router.delete('/patch/:id', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', body);
});

## TestClient For Integration Tests

`testClient` lets you spin up `TheAPI` for tests and gives you convenient request helpers (`get/post/patch/delete`), generated JWT tokens, and utilities like `deleteTables`/`truncateTables`.

Import:

```typescript
import { createRoutings, testClient } from 'the-api';
```

Parameters of `testClient(options?)`:

- `migrationDirs?: string[]` - migration folders used by internal routings created inside `testClient`
- `routingOptions?: { migrationDirs?: string[] }` - explicit routing options for internal routings (`crudParams` and `newRoutings`)
- `crudParams?: CrudBuilderOptionsType[]` - list of `router.crud(...)` configs that will be registered automatically
- `roles?: Roles | Record<string, string[]>` - roles instance or roles map (map is auto-initialized internally)
- `routings?: Routings[]` - extra routings/middlewares you already created
- `newRoutings?: (router: Routings) => void` - callback to append custom routes to a new internal `Routings` instance
- `theApiOptions?: Omit<TheApiOptionsType, 'routings' | 'roles' | 'migrationDirs'>` - additional `TheAPI` options (for example `port`, `emailTemplates`)

Helper:

- `createRoutings(options?)` - shorthand for `new Routings(options)`, useful in tests for better readability and typed setup.

What `testClient` returns:

- `theAPI` - initialized `TheAPI` instance (call `await theAPI.init()` in tests)
- `client` - request helper with methods: `get`, `post`, `patch`, `delete`, `postForm`, `postFormRequest`, `deleteTables`, `truncateTables`, `readFile`, `generateGWT`, `storeValue`, `getValue`
- `tokens` - ready-to-use JWT tokens for default test users (`root`, `admin`, `registered`, `manager`, `unknown`, `noRole`, `noToken`)
- `users` - default test users payload
- `DateTime` - `luxon` `DateTime` export for convenience in tests

Minimal example:

```typescript
import { test, expect } from 'bun:test';
import { testClient } from 'the-api';

const { theAPI, client } = await testClient({
  crudParams: [{ table: 'messages' }],
  migrationDirs: ['./migrations'],
});

test('messages list', async () => {
  await theAPI.init();
  const { result } = await client.get('/messages');
  expect(Array.isArray(result)).toEqual(true);
});
```

Example with all parameters and returned helpers:

```typescript
import { test, expect } from 'bun:test';
import { Routings, middlewares, testClient } from 'the-api';

const router = new Routings({ migrationDirs: ['./migrations'] });
router.get('/ping', async (c) => c.set('result', { ok: true }));

const roles = {
  root: ['*'],
  admin: ['messages.get'],
};

const {
  theAPI,
  client,
  tokens,
  users,
  DateTime,
} = await testClient({
  migrationDirs: ['./migrations'],
  crudParams: [{ table: 'messages' }],
  roles,
  routings: [middlewares.errors, router],
  theApiOptions: { port: 7788, emailTemplates: { demo: { subject: 's', text: 't' } } },
});

test('full testClient usage', async () => {
  await theAPI.init();
  await client.post('/messages', { body: `created ${DateTime.now().toISO()}` }, tokens.root);
  const { result } = await client.get('/messages', tokens.admin);
  expect(result.length > 0).toEqual(true);
  expect(users.root.id).toEqual(1);
  await client.truncateTables('messages');
  await client.deleteTables();
});
```

Example with `createRoutings` + `routings`:

```typescript
import { test, expect } from 'bun:test';
import { createRoutings, testClient } from 'the-api';
import type { AppContext } from 'the-api';

const router = createRoutings({ migrationDirs: ['./tests/migrations'] });

router.get('/check-migration', async (c: AppContext) => {
  await c.var.dbWrite('testNews').insert({ name: 'test' });
  c.set('result', await c.var.db('testNews'));
});

const { theAPI, client } = await testClient({ routings: [router] });

test('migration route', async () => {
  await theAPI.init();
  const { result } = await client.get('/check-migration');
  expect(result[0].name).toEqual('test');
});
```

Example with `newRoutings` (no manual router creation):

```typescript
import { test, expect } from 'bun:test';
import { testClient } from 'the-api';
import type { AppContext, TestClientOptionsType } from 'the-api';

const newRoutings: NonNullable<TestClientOptionsType['newRoutings']> = (router) => {
  router.get('/check-migration', async (c: AppContext) => {
    await c.var.dbWrite('testNews').insert({ name: 'test' });
    c.set('result', await c.var.db('testNews'));
  });
};

const { theAPI, client } = await testClient({
  migrationDirs: ['./tests/migrations'],
  newRoutings,
});

test('migration route via newRoutings', async () => {
  await theAPI.init();
  const { result } = await client.get('/check-migration');
  expect(result[0].name).toEqual('test');
});
```