# AGENTS.md

## Start here: what the user must have

Before using `the-api` in an application, the user needs:

- Node.js 18+ or Bun 1+.
- PostgreSQL running and reachable from the application.
- `the-api` installed in the application.
- Database tables created before the API starts, usually through migrations.

Install:

```bash
# Bun
bun add the-api

# npm
npm install the-api
```

If the application runs on Node.js ESM, keep `"type": "module"` in
`package.json`.

Minimal environment:

```env
PORT=7788
JWT_SECRET=change-me
JWT_EXPIRES_IN=1h

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
```

Example PostgreSQL schema used throughout this FAQ:

```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  "companyName" TEXT,
  roles TEXT[] DEFAULT ARRAY[]::TEXT[]
);

CREATE TABLE ships (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  "categoryId" INTEGER REFERENCES categories(id),
  "userId" INTEGER REFERENCES users(id),
  price NUMERIC,
  status TEXT DEFAULT 'draft',
  sold BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  "externalId" TEXT,
  "externalUrl" TEXT,
  "timeCreated" TIMESTAMP DEFAULT now(),
  "timeUpdated" TIMESTAMP,
  "timeDeleted" TIMESTAMP
);

CREATE TABLE images (
  id SERIAL PRIMARY KEY,
  "shipId" INTEGER REFERENCES ships(id),
  name TEXT NOT NULL,
  "originalName" TEXT,
  path TEXT NOT NULL,
  "isMain" BOOLEAN DEFAULT false
);

CREATE TABLE regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE lang (
  id SERIAL PRIMARY KEY,
  lang TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE ship_owners (
  id SERIAL PRIMARY KEY,
  "shipId" INTEGER REFERENCES ships(id),
  "userId" INTEGER REFERENCES users(id),
  role TEXT
);
```

Seed data for request/response examples:

```sql
INSERT INTO categories (id, name) VALUES (1, 'Cargo'), (2, 'Tanker');

INSERT INTO users (id, email, "companyName", roles)
VALUES
  (1, 'owner@example.com', 'Blue Ocean Ltd', ARRAY['registered']),
  (2, 'admin@example.com', 'Admin Co', ARRAY['admin']);

INSERT INTO ships (id, name, "categoryId", "userId", price, status, sold, deleted)
VALUES
  (1, 'Aurora', 1, 1, 1200000, 'published', false, false),
  (2, 'Baltic Star', 2, 1, 2200000, 'draft', false, false),
  (3, 'Old Wave', 1, 2, 500000, 'archived', true, true);

INSERT INTO images ("shipId", name, "originalName", path, "isMain")
VALUES
  (1, 'aurora-main.webp', 'aurora.jpg', '/files/ships/aurora-main.webp', true),
  (1, 'aurora-deck.webp', 'deck.jpg', '/files/ships/aurora-deck.webp', false),
  (2, 'baltic-main.webp', 'baltic.jpg', '/files/ships/baltic-main.webp', true);

INSERT INTO regions (id, name) VALUES (1, 'Europe'), (2, 'Asia');

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('ships_id_seq', (SELECT MAX(id) FROM ships));
SELECT setval('images_id_seq', (SELECT MAX(id) FROM images));
SELECT setval('regions_id_seq', (SELECT MAX(id) FROM regions));
```

Minimal application:

```ts
import { Routings, TheAPI, middlewares } from 'the-api';

const router = new Routings({ migrationDirs: ['./migrations'] });

router.crud({ table: 'ships' });

const theAPI = new TheAPI({
  routings: [middlewares.common, router],
});

await theAPI.up();
```

## FAQ by example

This FAQ is written for users who want to build an API quickly and for agents
who need enough examples to answer follow-up questions without guessing.

### How do I create the fastest possible API?

Create a router, register CRUD for a table, and start `TheAPI`:

```ts
import { Routings, TheAPI, middlewares } from 'the-api';

const router = new Routings();

router.crud({ table: 'ships' });

const theAPI = new TheAPI({
  routings: [middlewares.common, router],
});

await theAPI.up();
```

Request:

```bash
curl http://localhost:7788/status
```

Response:

```json
{
  "result": { "ok": 1 },
  "error": false,
  "requestTime": 1,
  "serverTime": "2026-03-05T13:47:54.709Z",
  "logId": "ab12cd34"
}
```

### What endpoints do I get from `router.crud({ table: 'ships' })`?

You get collection and record endpoints:

- `GET /ships` - list ships.
- `GET /ships/:id` - read one ship.
- `POST /ships` - create a ship.
- `PATCH /ships/:id` - update a ship.
- `DELETE /ships/:id` - delete or soft-delete a ship.

Request:

```bash
curl http://localhost:7788/ships?_sort=id
```

Response:

```json
{
  "result": [
    {
      "id": 1,
      "name": "Aurora",
      "categoryId": 1,
      "userId": 1,
      "price": "1200000",
      "status": "published",
      "sold": false,
      "deleted": false,
      "externalId": null,
      "externalUrl": null,
      "timeCreated": "2026-03-05T13:47:54.709Z",
      "timeUpdated": null,
      "timeDeleted": null
    },
    {
      "id": 2,
      "name": "Baltic Star",
      "categoryId": 2,
      "userId": 1,
      "price": "2200000",
      "status": "draft",
      "sold": false,
      "deleted": false,
      "externalId": null,
      "externalUrl": null,
      "timeCreated": "2026-03-05T13:48:01.123Z",
      "timeUpdated": null,
      "timeDeleted": null
    }
  ],
  "meta": {
    "total": 2,
    "limit": 0,
    "skip": 0,
    "page": 1,
    "pages": 1,
    "isFirstPage": true,
    "isLastPage": true
  },
  "error": false,
  "requestTime": 7,
  "serverTime": "2026-03-05T13:49:10.001Z"
}
```

### What happens when I create a record?

Request:

```bash
curl -X POST http://localhost:7788/ships \
  -H "Content-Type: application/json" \
  -d '{"name":"North Wind","categoryId":1,"userId":1,"price":1500000}'
```

Response:

```json
{
  "result": {
    "id": 4,
    "name": "North Wind",
    "categoryId": 1,
    "userId": 1,
    "price": "1500000",
    "status": "draft",
    "sold": false,
    "deleted": false,
    "timeCreated": "2026-03-05T13:51:00.000Z",
    "timeUpdated": null,
    "timeDeleted": null
  },
  "error": false,
  "requestTime": 24,
  "serverTime": "2026-03-05T13:51:00.030Z"
}
```

### What happens when I patch a record?

Request:

```bash
curl -X PATCH http://localhost:7788/ships/1 \
  -H "Content-Type: application/json" \
  -d '{"price":1300000,"status":"published"}'
```

Response:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "categoryId": 1,
    "userId": 1,
    "price": "1300000",
    "status": "published",
    "sold": false,
    "deleted": false,
    "timeUpdated": "2026-03-05T13:52:00.000Z"
  },
  "error": false,
  "requestTime": 19,
  "serverTime": "2026-03-05T13:52:00.020Z"
}
```

### What query parameters are applied automatically?

`the-api` automatically parses query parameters into filters, sorting, field
selection, joins, pagination, search, and validation. The most common ones:

- `_fields=name,price` - return only selected fields.
- `_sort=name` - sort ascending.
- `_sort=-price,-id` - sort descending by price, then id.
- `_limit=20` - limit.
- `_page=2` - page number when `_limit` is set.
- `_skip=40` - offset.
- `_after=...` - cursor pagination.
- `_search=aurora` - fuzzy search by `searchFields`.
- `_join=images` - enable `joinOnDemand` joins.
- `_lang=en` - language value available to `whereBindings`.
- `_unlimited=true` - request unlimited mode when supported by the builder.
- `name=Aurora` - equality filter.
- `name=Aurora&name=Baltic Star` - OR for the same field.
- `name!=Aurora` - not equal.
- `name~=Auro` - fuzzy/like-style field filter.
- `_from_price=1000000` - lower bound.
- `_to_price=2000000` - upper bound.
- `_in_status=["draft","published"]` - JSON array membership.
- `_not_in_status=["archived"]` - inverse membership.
- `_null_timeDeleted=true` - `IS NULL`.
- `_not_null_timeDeleted=true` - `IS NOT NULL`.

Request:

```bash
curl 'http://localhost:7788/ships?_fields=id,name,price&_sort=-price&_limit=1'
```

Response:

```json
{
  "result": [
    {
      "id": 2,
      "name": "Baltic Star",
      "price": "2200000"
    }
  ],
  "meta": {
    "total": 2,
    "limit": 1,
    "skip": 0,
    "page": 1,
    "nextPage": 2,
    "pages": 2,
    "isFirstPage": true,
    "isLastPage": false
  },
  "error": false,
  "requestTime": 5,
  "serverTime": "2026-03-05T13:55:00.000Z"
}
```

### How do I enable search?

Add `searchFields`:

```ts
router.crud({
  table: 'ships',
  searchFields: ['name'],
});
```

Request:

```bash
curl 'http://localhost:7788/ships?_search=Auro'
```

Response:

```json
{
  "result": [
    {
      "id": 1,
      "name": "Aurora",
      "categoryId": 1
    }
  ],
  "meta": { "total": 1, "limit": 0, "skip": 0, "page": 1, "pages": 1 },
  "error": false,
  "requestTime": 6,
  "serverTime": "2026-03-05T13:56:00.000Z"
}
```

Search uses PostgreSQL behavior from the underlying builder and `pg_trgm`
similarity threshold configured by `DB_TRGM_SIMILARITY_THRESHOLD`.

### How do I join another table?

Use `join`:

```ts
router.crud({
  table: 'ships',
  join: [
    {
      table: 'categories',
      where: '"categories"."id" = "ships"."categoryId"',
    },
  ],
});
```

Request:

```bash
curl 'http://localhost:7788/ships/1'
```

Response:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "categoryId": 1,
    "categories": [
      {
        "id": 1,
        "name": "Cargo"
      }
    ]
  },
  "error": false,
  "requestTime": 8,
  "serverTime": "2026-03-05T13:57:00.000Z"
}
```

### How do I join only selected fields?

Use `fields`:

```ts
router.crud({
  table: 'ships',
  join: [
    {
      table: 'images',
      where: '"ships"."id" = "images"."shipId"',
      fields: ['id', 'name', 'originalName', 'path'],
      orderBy: '"isMain" DESC, "id" ASC',
      limit: 1,
    },
  ],
});
```

Request:

```bash
curl 'http://localhost:7788/ships/1?_fields=id,name,images'
```

Response:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "images": [
      {
        "id": 1,
        "name": "aurora-main.webp",
        "originalName": "aurora.jpg",
        "path": "/files/ships/aurora-main.webp"
      }
    ]
  },
  "error": false,
  "requestTime": 9,
  "serverTime": "2026-03-05T13:58:00.000Z"
}
```

### How do I join one scalar field as an alias?

Use `field` and `alias`:

```ts
router.crud({
  table: 'ships',
  join: [
    {
      table: 'categories',
      where: '"categories"."id" = "ships"."categoryId"',
      field: 'name',
      alias: 'categoryName',
    },
  ],
});
```

Request:

```bash
curl 'http://localhost:7788/ships?_fields=id,name,categoryName&_sort=id'
```

Response:

```json
{
  "result": [
    {
      "id": 1,
      "name": "Aurora",
      "categoryName": "Cargo"
    },
    {
      "id": 2,
      "name": "Baltic Star",
      "categoryName": "Tanker"
    }
  ],
  "meta": { "total": 2, "limit": 0, "skip": 0, "page": 1, "pages": 1 },
  "error": false,
  "requestTime": 7,
  "serverTime": "2026-03-05T13:59:00.000Z"
}
```

### How do I make a join optional and load it only on demand?

Use `joinOnDemand`; clients must request it with `_join`:

```ts
router.crud({
  table: 'ships',
  joinOnDemand: [
    {
      table: 'images',
      where: '"ships"."id" = "images"."shipId"',
      fields: ['id', 'path'],
      alias: 'images',
    },
  ],
});
```

Without `_join`:

```bash
curl 'http://localhost:7788/ships/1?_fields=id,name'
```

```json
{
  "result": {
    "id": 1,
    "name": "Aurora"
  },
  "error": false,
  "requestTime": 3,
  "serverTime": "2026-03-05T14:00:00.000Z"
}
```

With `_join`:

```bash
curl 'http://localhost:7788/ships/1?_join=images&_fields=id,name,images'
```

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "images": [
      {
        "id": 1,
        "path": "/files/ships/aurora-main.webp"
      },
      {
        "id": 2,
        "path": "/files/ships/aurora-deck.webp"
      }
    ]
  },
  "error": false,
  "requestTime": 8,
  "serverTime": "2026-03-05T14:00:30.000Z"
}
```

### How do I join the same table twice?

Use `as` for the SQL alias and `alias` for the output key:

```ts
router.crud({
  table: 'ships',
  join: [
    {
      table: 'ships',
      as: 'sameCategoryShip',
      alias: 'sameCategoryShip',
      where:
        '"sameCategoryShip"."categoryId" = "ships"."categoryId" ' +
        'AND "sameCategoryShip"."id" != "ships"."id"',
      fields: ['id', 'name'],
      limit: 1,
      byIndex: 0,
    },
  ],
});
```

Response shape:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "sameCategoryShip": {
      "id": 3,
      "name": "Old Wave"
    }
  },
  "error": false
}
```

### How do I use dynamic join bindings?

Use `whereBindings`. Values can come from `query`, request env/context, or values
set by earlier middleware.

```ts
router.get('/ships', async (c, next) => {
  c.set('currentLang' as never, String(c.var.query._lang || 'en'));
  await next();
});

router.crud({
  table: 'ships',
  join: [
    {
      table: 'lang',
      alias: 'nameLang',
      where: '"lang"."lang" = :l AND "lang"."key" = "ships"."name"',
      whereBindings: { l: 'env.currentLang' },
      field: 'value',
    },
  ],
});
```

Request:

```bash
curl 'http://localhost:7788/ships?_lang=en&_fields=id,name,nameLang'
```

Response:

```json
{
  "result": [
    {
      "id": 1,
      "name": "Aurora",
      "nameLang": "Aurora"
    }
  ],
  "error": false
}
```

### How do I hide fields from responses?

Use `fieldRules.hidden`:

```ts
router.crud({
  table: 'ships',
  fieldRules: {
    hidden: ['externalId', 'externalUrl'],
  },
});
```

Request:

```bash
curl 'http://localhost:7788/ships/1'
```

Response:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "categoryId": 1,
    "userId": 1,
    "price": "1200000",
    "status": "published"
  },
  "error": false,
  "requestTime": 5,
  "serverTime": "2026-03-05T14:01:00.000Z"
}
```

Hidden fields also become readonly, so clients cannot change them through normal
CRUD POST/PATCH.

### How do I forbid clients from adding certain fields on create?

Use `fieldRules.readOnly` for fields that must be ignored in POST/PATCH:

```ts
router.crud({
  table: 'ships',
  fieldRules: {
    readOnly: ['id', 'timeCreated', 'timeUpdated', 'deleted', 'status'],
  },
});
```

Request:

```bash
curl -X POST http://localhost:7788/ships \
  -H "Content-Type: application/json" \
  -d '{"id":999,"name":"Client Id Is Ignored","status":"published"}'
```

Response:

```json
{
  "result": {
    "id": 4,
    "name": "Client Id Is Ignored",
    "status": "draft"
  },
  "error": false
}
```

Important: automatic validation validates known fields but does not, by itself,
reject every extra unknown body key. If the application needs a strict whitelist,
add custom validation. A resolver replaces that section's generated validation,
so include any required/type checks you still need in the resolver or use a
middleware before CRUD.

```ts
const allowedPostFields = new Set(['name', 'categoryId', 'userId', 'price']);

router.crud({
  table: 'ships',
  validation: {
    body: {
      post: (c) => {
        const body = (c.var.body || {}) as Record<string, unknown>;
        const errors = Object.keys(body)
          .filter((field) => !allowedPostFields.has(field))
          .map((field) => ({
            field: `body.${field}`,
            message: `Unknown field: ${field}`,
            expected: { allowed: [...allowedPostFields] },
            value: body[field],
          }));

        if (!body.name) {
          errors.push({
            field: 'body.name',
            message: 'This field is required but was not provided',
            expected: { type: 'string', required: true },
            value: null,
          });
        }

        return errors.length ? errors : undefined;
      },
    },
  },
});
```

### How do I forbid editing fields?

Use `fieldRules.readOnly`:

```ts
router.crud({
  table: 'ships',
  fieldRules: {
    readOnly: ['id', 'userId', 'timeCreated', 'deleted', 'status'],
  },
});
```

Request:

```bash
curl -X PATCH http://localhost:7788/ships/1 \
  -H "Content-Type: application/json" \
  -d '{"userId":2,"status":"archived","price":1250000}'
```

Response:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "userId": 1,
    "status": "published",
    "price": "1250000"
  },
  "error": false
}
```

`userId` and `status` stay unchanged, while `price` changes.

### How do I expose hidden fields only to users with permission?

Use `visibleFor`:

```ts
router.crud({
  table: 'ships',
  fieldRules: {
    hidden: ['externalId', 'externalUrl'],
    visibleFor: {
      'ships.getInternalInfo': ['externalId', 'externalUrl'],
    },
  },
});
```

With no permission:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora"
  },
  "error": false
}
```

With permission:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "externalId": "ext-1001",
    "externalUrl": "https://example.com/ext-1001"
  },
  "error": false
}
```

### How do I allow editing readonly fields only with permission?

Use `editableFor`:

```ts
router.crud({
  table: 'ships',
  fieldRules: {
    readOnly: ['status'],
    editableFor: {
      'ships.editStatus': ['status'],
    },
  },
});
```

Users without `ships.editStatus` cannot change `status`; users with that
permission can.

### How do I protect CRUD methods with roles?

Use `the-api-roles` and `permissions.methods`:

```ts
import Roles from 'the-api-roles';
import { Routings, TheAPI } from 'the-api';

const roles = new Roles({
  root: ['*'],
  admin: ['ships.*'],
  registered: ['ships.get'],
  guest: ['ships.get'],
});

const router = new Routings();

router.crud({
  table: 'ships',
  permissions: {
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

const theAPI = new TheAPI({ routings: [router], roles });
```

Without permission:

```bash
curl -X POST http://localhost:7788/ships \
  -H "Content-Type: application/json" \
  -d '{"name":"Denied"}'
```

Response:

```json
{
  "result": {
    "code": 15,
    "status": 403,
    "description": "Insufficient permissions",
    "name": "ACCESS_DENIED",
    "additional": [],
    "error": true
  },
  "error": true,
  "serverTime": "2026-03-05T14:02:00.000Z"
}
```

### How do owner permissions work?

The virtual `owner` role can be used for record-level permissions. `TheAPI`
preloads the object and passes it to `the-api-roles` as `objectToCheck`.

```ts
const roles = {
  root: ['*'],
  owner: ['ships.patch', 'ships.delete'],
};

router.crud({
  table: 'ships',
  prefix: 'ships',
  userIdFieldName: 'userId',
});
```

A user whose token has `userId` matching the record's `userId` can patch/delete
that record when owner permissions match.

### How do I read an error response?

Every expected error is returned inside the normal envelope:

```json
{
  "result": {
    "code": 22,
    "status": 400,
    "description": "Validation error",
    "name": "VALIDATION_ERROR",
    "additional": [
      {
        "field": "body.name",
        "message": "This field is required but was not provided",
        "expected": {
          "type": "string",
          "required": true
        },
        "value": null
      }
    ],
    "error": true
  },
  "error": true,
  "requestTime": 4,
  "serverTime": "2026-03-05T14:03:00.000Z",
  "logId": "ef45ab90"
}
```

Read:

- `error` - top-level boolean for easy client checks.
- `result.name` - machine-readable error name.
- `result.code` - application error code.
- `result.status` - HTTP status.
- `result.description` - human-readable default description.
- `result.additional` - structured details.
- `logId` - request id in logs.

### What built-in errors exist?

Core errors:

- `DEFAULT` - code `11`, status `500`.
- `ACCESS_DENIED` - code `15`, status `403`.
- `NOT_FOUND` - code `21`, status `404`.
- `INVALID_TOKEN` - code `25`, status `401`.
- `VALIDATION_ERROR` - code `22`, status `400`.
- `ERROR_QUERY_VALUE` - code `41`, status `409`.

Files errors:

- `FILES_INVALID_FILE` - code `130`, status `400`.
- `FILES_NO_STORAGE_CONFIGURED` - code `131`, status `500`.
- `FILES_NO_MINIO_CONFIGURED` - code `132`, status `500`.
- `FILES_INVALID_IMAGE_SIZES_CONFIG` - code `133`, status `500`.

Email error:

- `EMAIL_REQUIRES_FIELDS` - code `125`, status `400`.

`bodyLimit({ maxSize })` returns status `413` with `Payload Too Large`.

### How do I add and throw my own error?

Register errors on a `Routings` instance:

```ts
const router = new Routings();

router.errors({
  SHIP_ALREADY_SOLD: {
    code: 1001,
    status: 409,
    description: 'Ship is already sold',
  },
});

router.post('/ships/:id/sell', async (c) => {
  const ship = await c.var.db('ships').where({ id: c.req.param('id') }).first();

  if (ship?.sold) {
    throw new Error('SHIP_ALREADY_SOLD');
  }

  c.set('result', { ok: true });
});
```

Response:

```json
{
  "result": {
    "code": 1001,
    "status": 409,
    "description": "Ship is already sold",
    "name": "SHIP_ALREADY_SOLD",
    "additional": [],
    "error": true
  },
  "error": true,
  "requestTime": 3,
  "serverTime": "2026-03-05T14:04:00.000Z"
}
```

With additional details:

```ts
throw Object.assign(new Error('SHIP_ALREADY_SOLD'), {
  additional: [{ message: 'shipId=1', field: 'id', value: 1 }],
});
```

### How do I add validation?

Automatic validation is generated from the DB schema. Custom validation can
override or extend it:

```ts
router.crud({
  table: 'ships',
  validation: {
    body: {
      post: {
        name: { type: 'string', required: true },
        categoryId: { type: 'number', required: true },
        price: { type: 'number', min: 0 },
      },
      patch: {
        price: { type: 'number', min: 0 },
      },
    },
  },
});
```

Request:

```bash
curl -X POST http://localhost:7788/ships \
  -H "Content-Type: application/json" \
  -d '{"price":-5}'
```

Response:

```json
{
  "result": {
    "name": "VALIDATION_ERROR",
    "status": 400,
    "code": 22,
    "additional": [
      {
        "field": "body.name",
        "message": "This field is required but was not provided",
        "expected": { "type": "string", "required": true },
        "value": null
      },
      {
        "field": "body.price",
        "message": "Expected a number greater than or equal to 0, but received -5",
        "expected": { "type": "number", "min": 0 },
        "value": -5
      }
    ],
    "error": true
  },
  "error": true
}
```

### How do I disable validation?

Disable all validation:

```ts
router.crud({
  table: 'ships',
  validation: {},
});
```

Disable only params validation:

```ts
router.crud({
  table: 'ships',
  validation: {
    params: {},
  },
});
```

Disable only body validation:

```ts
router.crud({
  table: 'ships',
  validation: {
    body: {},
  },
});
```

### How do I upload files locally?

Set `FILES_FOLDER` and add `middlewares.files`:

```env
FILES_FOLDER=public/files
IMAGE_SIZES=thumb:200x200,large:1200x800
```

```ts
import { Routings, TheAPI, middlewares } from 'the-api';

const router = new Routings();

router.post('/ships/:id/images', async (c) => {
  const files = await c.var.files.uploadBody(
    c.var.body as Record<string, unknown>,
    `ships/${c.req.param('id')}`,
    { fields: ['file', 'file[]'], imagesOnly: true },
  );

  c.set('result', files);
});

const theAPI = new TheAPI({
  routings: [middlewares.common, middlewares.files, router],
});
```

Request:

```bash
curl -X POST http://localhost:7788/ships/1/images \
  -F "file=@./aurora.jpg"
```

Response:

```json
{
  "result": [
    {
      "fullPath": "public/files/ships/1/ab/cd/abcdef...",
      "path": "ships/1/ab/cd/abcdef...",
      "name": "abcdef...",
      "size": 348219,
      "originalName": "aurora.jpg",
      "sizes": {
        "thumb": {
          "path": "public/files/ships/1/ab/cd/abcdef.../thumb.webp",
          "width": 200,
          "height": 200,
          "size": 8042
        },
        "large": {
          "path": "public/files/ships/1/ab/cd/abcdef.../large.webp",
          "width": 1200,
          "height": 800,
          "size": 90521
        }
      }
    }
  ],
  "error": false
}
```

### How do I upload files to MinIO or S3-compatible storage?

Set MinIO/S3-compatible env variables:

```env
MINIO_ENDPOINT=minio.example.com
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=access-key
MINIO_SECRET_KEY=secret-key
MINIO_BUCKET_NAME=prod
IMAGE_SIZES=thumb:200x200,large:1200x800
```

Then use the same `middlewares.files` and upload code as local storage. If
`FILES_FOLDER` is set, local storage wins. Leave `FILES_FOLDER` unset for MinIO.

For AWS S3, this package currently uses the MinIO client and exposes only the
`MINIO_*`/`FilesOptions.minio` configuration. Use an S3-compatible endpoint that
works with the MinIO client, or extend `FilesOptions` before relying on AWS
features such as region-specific configuration.

Response shape for object storage:

```json
{
  "result": [
    {
      "fullPath": "ships/1/ab/cd/abcdef...",
      "path": "ships/1/ab/cd/abcdef...",
      "name": "abcdef...",
      "size": 348219,
      "bucket": "prod",
      "originalName": "aurora.jpg",
      "sizes": {
        "thumb": {
          "path": "ships/1/ab/cd/abcdef.../thumb.webp",
          "width": 200,
          "height": 200,
          "size": 8042
        }
      }
    }
  ],
  "error": false
}
```

### How do I get a presigned URL?

Use `Files.getPresignedUrl()` when MinIO/S3-compatible storage is configured:

```ts
router.get('/files/url', async (c) => {
  const path = String(c.var.query.path || '');
  const url = await c.var.files.getPresignedUrl(path);
  c.set('result', { url });
});
```

Response:

```json
{
  "result": {
    "url": "https://minio.example.com/prod/ships/1/file.webp?X-Amz-Algorithm=..."
  },
  "error": false
}
```

### What are `relations` and how do I use them?

`relations` let the API return normalized data. The main `result` keeps ids, and
the top-level `relations` object contains full related objects keyed by id.

Definition:

```ts
router.crud({
  table: 'ships',
  relations: {
    categoryId: {
      table: 'categories',
      relationIdName: 'id',
    },
    userId: {
      table: 'users',
      relationIdName: 'id',
      fieldRules: {
        hidden: ['email'],
      },
    },
  },
});
```

Request:

```bash
curl 'http://localhost:7788/ships?_fields=id,name,categoryId,userId,-relations'
```

Response:

```json
{
  "result": [
    {
      "id": 1,
      "name": "Aurora",
      "categoryId": 1,
      "userId": 1
    }
  ],
  "relations": {
    "categoryId": {
      "1": {
        "id": 1,
        "name": "Cargo"
      }
    },
    "userId": {
      "1": {
        "id": 1,
        "companyName": "Blue Ocean Ltd"
      }
    }
  },
  "error": false
}
```

Use `join` when every result should embed the related data. Use `relations` when
clients benefit from normalized responses and deduplicated related objects.

### How do I change the URL prefix?

Use `prefix`:

```ts
router.crud({
  table: 'ships',
  prefix: 'vessels',
});
```

Endpoints become:

- `GET /vessels`
- `GET /vessels/:id`
- `POST /vessels`
- `PATCH /vessels/:id`
- `DELETE /vessels/:id`

Permissions also use the prefix: `vessels.get`, `vessels.post`, etc.

### How do I use a non-public schema?

Use `schema`:

```ts
router.crud({
  schema: 'fleet',
  table: 'ships',
});
```

Validation introspection will look for `fleet.ships`.

### How do I alias fields?

Use `aliases`:

```ts
router.crud({
  table: 'ships',
  aliases: {
    name: 'title',
  },
});
```

Response:

```json
{
  "result": {
    "id": 1,
    "name": "Aurora",
    "title": "Aurora"
  },
  "error": false
}
```

### How do I set a permanent filter?

Use `defaultWhere`:

```ts
router.crud({
  table: 'ships',
  defaultWhere: {
    deleted: false,
    sold: false,
  },
});
```

All CRUD reads include this filter unless the builder specifically handles an
operation differently.

For SQL that cannot be represented as an object, use `defaultWhereRaw`:

```ts
router.crud({
  table: 'ships',
  defaultWhereRaw: '"ships"."deleted" = false AND "ships"."sold" = false',
});
```

### How do I set default sorting or raw sorting?

Use `defaultSort`:

```ts
router.crud({
  table: 'ships',
  defaultSort: '-timeCreated',
});
```

Use `sortRaw` for SQL-level custom sorting:

```ts
router.crud({
  table: 'ships',
  sortRaw: 'COALESCE("ships"."timeUpdated", "ships"."timeCreated") DESC',
});
```

### How do I include soft-deleted records?

Use `includeDeleted` and optionally `deletedReplacements`:

```ts
router.crud({
  table: 'ships',
  includeDeleted: true,
  deletedReplacements: {
    name: 'Deleted ship',
    externalUrl: '',
  },
});
```

Response for a deleted record:

```json
{
  "result": {
    "id": 3,
    "name": "Deleted ship",
    "deleted": true,
    "sold": true
  },
  "error": false
}
```

### How do I pass services or state to handlers?

The request context contains values in `c.var`:

```ts
router.get('/me', async (c) => {
  c.set('result', {
    user: c.var.user,
    query: c.var.query,
    bodyType: c.var.bodyType,
  });
});
```

Common values:

- `c.var.db` - read DB connection.
- `c.var.dbWrite` - write DB connection.
- `c.var.dbTables` - introspected tables.
- `c.var.user` - JWT user or guest user.
- `c.var.body` - parsed request body.
- `c.var.query` - normalized query.
- `c.var.files` - file service when files middleware is enabled.
- `c.var.email` - email service when email middleware is enabled.
- `c.var.log` - request logger.
- `c.var.error` - error setter.

### How do I send email?

Configure SMTP, add `middlewares.email`, and call `c.var.email`:

```ts
const theAPI = new TheAPI({
  routings: [middlewares.common, middlewares.email, router],
  emailTemplates: {
    shipCreated: {
      subject: 'Ship {{name}} was created',
      text: 'Ship {{name}} is now available.',
    },
  },
});

router.post('/notify', async (c) => {
  await c.var.email({
    to: 'owner@example.com',
    template: 'shipCreated',
    data: { name: 'Aurora' },
  });

  c.set('result', { ok: true });
});
```

Response:

```json
{
  "result": { "ok": true },
  "error": false
}
```

### How do I use `appendQueryParams`?

Use it in middleware before CRUD to enforce or add query filters:

```ts
router.get('/my-ships', async (c, next) => {
  c.var.appendQueryParams({
    userId: c.var.user.userId as number,
    deleted: false,
  });
  await next();
});

router.crud({
  table: 'ships',
  prefix: 'my-ships',
});
```

A request to `/my-ships` is processed as if it included `?userId=<currentUser>`.

### How do I add body size limits?

Use `bodyLimit`:

```ts
import { bodyLimit, Routings, TheAPI } from 'the-api';

const router = new Routings();

const theAPI = new TheAPI({
  routings: [
    bodyLimit({ maxSize: 5 * 1024 * 1024 }),
    router,
  ],
});
```

Error response:

```json
{
  "result": {
    "error": true,
    "name": "Payload Too Large",
    "status": 413,
    "code": 0,
    "additional": []
  },
  "error": true,
  "serverTime": "2026-03-05T14:05:00.000Z"
}
```

### How do I use CORS, CSRF, compression, and ETag?

They are re-exported from Hono:

```ts
import {
  Routings,
  TheAPI,
  cors,
  csrf,
  compress,
  etag,
  middlewares,
} from 'the-api';

const theAPI = new TheAPI({
  routings: [
    cors(),
    csrf(),
    compress(),
    etag(),
    middlewares.common,
    router,
  ],
});
```

### What does every CRUD definition parameter mean?

Parameter map for `CrudBuilderOptionsType`:

| Parameter | Meaning | Example |
| --- | --- | --- |
| `c` | Request context passed through to the underlying builder. Rarely set manually. | Internal use |
| `table` | Database table name. Required. | `{ table: 'ships' }` |
| `prefix` | URL prefix and permission prefix instead of table name. | `{ table: 'ships', prefix: 'vessels' }` |
| `schema` | Database schema. | `{ schema: 'fleet', table: 'ships' }` |
| `aliases` | Adds field aliases in output/input mapping. | `{ aliases: { name: 'title' } }` |
| `join` | Always-loaded joins. | See join examples above |
| `joinOnDemand` | Joins enabled by `_join`. | `{ joinOnDemand: [...] }` |
| `leftJoin` | Builder-level left joins. Prefer join item `leftJoin` when joining inside a join. | `{ leftJoin: [...] }` |
| `leftJoinDistinct` | Builder pass-through for distinct left joins. Check `the-api-routings` before changing. | Advanced |
| `lang` | Language config passed to the builder. | Advanced localization |
| `translate` | Fields to translate. | `{ translate: ['name'] }` |
| `searchFields` | Fields used by `_search`. | `{ searchFields: ['name'] }` |
| `requiredFields` | Legacy required fields config. Prefer `validation` for new code. | `{ requiredFields: ['name'] }` |
| `fieldRules` | Hidden/readonly/permission-based field rules. | See field rules examples |
| `permissions` | CRUD method and owner permission config. | `{ permissions: { methods: ['*'] } }` |
| `defaultWhere` | Permanent object filter. | `{ defaultWhere: { deleted: false } }` |
| `defaultWhereRaw` | Permanent raw SQL filter. | `{ defaultWhereRaw: '"ships"."deleted" = false' }` |
| `defaultSort` | Default sort when query does not provide `_sort`. | `{ defaultSort: '-timeCreated' }` |
| `sortRaw` | Raw SQL sort expression. | `{ sortRaw: '"ships"."id" DESC' }` |
| `fieldsRaw` | Raw field selection pass-through to builder. Use sparingly. | Advanced |
| `includeDeleted` | Include soft-deleted records in reads. | `{ includeDeleted: true }` |
| `deletedReplacements` | Replace values for deleted records. | `{ deletedReplacements: { name: 'Deleted' } }` |
| `relations` | Normalized related datasets. | See relations example |
| `relationIdName` | Id field used inside relation lookups. | `{ relationIdName: 'uuid' }` |
| `tokenRequired` | Legacy/pass-through access flag. Prefer roles/permissions for new code. | Legacy |
| `ownerRequired` | Legacy/pass-through owner flag. Prefer roles `owner`. | Legacy |
| `rootRequired` | Legacy/pass-through root flag. Prefer roles. | Legacy |
| `access` | Legacy/pass-through access config. Prefer roles. | Legacy |
| `accessByStatuses` | Legacy/pass-through status access config. | Legacy |
| `dbTables` | Table metadata override for validation/introspection. | Tests/advanced |
| `cache` | Builder pass-through cache option. Check `the-api-routings`. | Advanced |
| `userIdFieldName` | Owner field name. Defaults to `userId`. | `{ userIdFieldName: 'ownerId' }` |
| `additionalFields` | Builder pass-through for computed/additional fields. | Advanced |
| `apiClientMethodNames` | Builder pass-through for generated API clients. | Advanced |
| `validation` | Auto/custom validation config. | See validation examples |

When a parameter is described as legacy or pass-through, `the-api` keeps it in
the type for compatibility, but the behavior is owned mostly by
`the-api-routings` or older applications. Do not invent new semantics here
without tests.

### What does every join parameter mean?

Parameter map for `CrudBuilderJoinType`:

| Parameter | Meaning | Example |
| --- | --- | --- |
| `table` | Joined table name. Required. | `{ table: 'images' }` |
| `schema` | Joined table schema. | `{ schema: 'fleet', table: 'images' }` |
| `alias` | Output key. Also selectable through `_fields`/`_join`. | `{ alias: 'mainImage' }` |
| `as` | SQL alias for joining the same table more than once. | `{ table: 'ships', as: 'relatedShip' }` |
| `where` | SQL join condition. | `'"ships"."id" = "images"."shipId"'` |
| `whereBindings` | Named binding paths. | `{ l: 'query._lang' }` |
| `defaultValue` | Fallback value when no join data exists. | `{ defaultValue: '[]' }` |
| `fields` | Selected fields from joined table. | `{ fields: ['id', 'path'] }` |
| `field` | One selected scalar field. | `{ field: 'name', alias: 'categoryName' }` |
| `orderBy` | Ordering for joined records. | `{ orderBy: '"isMain" DESC' }` |
| `limit` | Limit joined records. | `{ limit: 1 }` |
| `leftJoin` | Extra left join inside this join. | `{ leftJoin: ['ages', '"ages"."typeId"', '"types"."id"'] }` |
| `byIndex` | Return one item by index instead of an array. | `{ limit: 1, byIndex: 0 }` |
| `permission` | Permission required for this joined data. | `{ permission: 'ships.getImages' }` |

### What does every validation parameter mean?

`validation` can contain `params`, `query`, `headers`, and `body`:

```ts
router.crud({
  table: 'ships',
  validation: {
    params: {
      id: { type: 'number', required: true },
    },
    query: {
      _sort: { type: 'string' },
    },
    headers: {
      authorization: { type: 'string' },
    },
    body: {
      post: {
        name: { type: 'string', required: true },
      },
      patch: {
        name: { type: 'string' },
      },
    },
  },
});
```

Validation field rule parameters:

| Parameter | Meaning |
| --- | --- |
| `type` | `'string'`, `'number'`, `'boolean'`, `'date'`, `'enum'`, `'array'`, `'object'`, or an array of types |
| `required` | Field must be present and not empty |
| `enum` | Allowed values |
| `min` | Minimum number |
| `max` | Maximum number |
| `preprocess` | Function that transforms a value before validation |
| `items` | Schema for array items |
| `properties` | Schema for object properties |

Sections can also be functions, external validators with `safeParse`, `parse`,
or `validate`, or functions returning validation errors.

### What does every `TheAPI` option mean?

```ts
const theAPI = new TheAPI({
  routings: [middlewares.common, router],
  roles,
  emailTemplates,
  port: 7788,
  migrationDirs: ['./migrations'],
});
```

| Option | Meaning |
| --- | --- |
| `routings` | Required. List of `Routings` instances or arrays of `Routings` to register. |
| `roles` | Optional `the-api-roles` instance. Enables route and CRUD permission checks. |
| `emailTemplates` | Named email templates used by `middlewares.email`. |
| `port` | Port for `up()`/`upBun()`. Defaults to `PORT` env or `7788`. |
| `migrationDirs` | Extra migration directories for `Db`. Routings can also provide their own `migrationDirs`. |

### What does every `fieldRules` parameter mean?

```ts
fieldRules: {
  hidden: ['externalId'],
  readOnly: ['id', 'timeCreated'],
  visibleFor: {
    'ships.getInternalInfo': ['externalId'],
  },
  editableFor: {
    'ships.editStatus': ['status'],
  },
}
```

| Parameter | Meaning |
| --- | --- |
| `hidden` | Fields removed from responses unless the user has a matching `visibleFor` permission. Hidden fields also become readonly. |
| `readOnly` | Fields ignored in POST/PATCH unless the user has a matching `editableFor` permission. |
| `visibleFor` | Map of permission -> hidden fields that become visible for users with that permission. |
| `editableFor` | Map of permission -> readonly fields that become editable for users with that permission. |

### What does every `permissions` parameter mean?

```ts
permissions: {
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  owner: ['ships.getInternalInfo'],
}
```

| Parameter | Meaning |
| --- | --- |
| `methods` | CRUD methods protected by route permissions. Use `['*']` for all CRUD methods. |
| `owner` | Owner-specific permissions for field visibility/editability rules. If omitted and roles are enabled, owner permissions are resolved from the virtual role named `owner`. |

Permission names are generated from the table or prefix plus lower-case method:
`ships.get`, `ships.post`, `ships.patch`, `ships.delete`.

### What does every `FilesOptions` parameter mean?

`middlewares.files` creates `new Files()` from env. `createFiles(options)` lets
the application pass options explicitly:

```ts
const files = middlewares.createFiles({
  folder: 'public/files',
  imageSizes: [
    { name: 'thumb', width: 200, height: 200 },
    { name: 'large', width: 1200, height: 800 },
  ],
  minio: {
    bucketName: 'prod',
    endPoint: 'minio.example.com',
    port: 9000,
    useSSL: true,
    accessKey: 'access-key',
    secretKey: 'secret-key',
  },
});
```

| Option | Meaning |
| --- | --- |
| `folder` | Local storage root. If set, uploads are written to the local filesystem. |
| `imageSizes` | Either an array of `{ name, width, height }` or env-style string `thumb:200x200,large:1200x800`. Enables image variant generation. |
| `minio.bucketName` | Object storage bucket. Required for MinIO/S3-compatible uploads. |
| `minio.endPoint` | Object storage endpoint host. |
| `minio.port` | Object storage port. |
| `minio.useSSL` | Whether to use HTTPS. |
| `minio.accessKey` | Object storage access key. |
| `minio.secretKey` | Object storage secret key. |

Local `folder` takes precedence over MinIO. Leave `folder` unset when object
storage should be used.

### What do file upload helper options mean?

```ts
c.var.files.getBodyFiles(c.var.body as Record<string, unknown>, {
  fields: ['file', 'file[]'],
  imagesOnly: true,
});

c.var.files.uploadMany(files, 'ships/1', {
  imagesOnly: true,
});

c.var.files.uploadBody(c.var.body as Record<string, unknown>, 'ships/1', {
  fields: ['file'],
  imagesOnly: true,
});
```

| Option | Used by | Meaning |
| --- | --- | --- |
| `fields` | `getBodyFiles`, `uploadBody` | Form fields that can contain files. Defaults to `['file', 'file[]']`. |
| `imagesOnly` | `getBodyFiles`, `uploadMany`, `uploadBody` | Filters non-image files by MIME type before upload. |

Main file service methods:

| Method | Meaning |
| --- | --- |
| `upload(file, destDir)` | Upload one file. Generates image variants when configured and input is an image. |
| `uploadMany(files, destDir, options)` | Upload many files. |
| `uploadBody(body, destDir, options)` | Extract files from parsed form body and upload them. |
| `getBodyFiles(body, options)` | Extract `File` objects from parsed form body. |
| `delete(objectName)` | Delete a local file/path or object storage object. |
| `deleteImage(imageName, destDir)` | Delete all variants for generated image upload. |
| `getPresignedUrl(objectName, expiry)` | Create a MinIO/S3-compatible presigned read URL. |
| `getImageSizes()` | Return validated image size config. |

### What does every email config parameter mean?

`Email` reads env by default, and `middlewares.email` exposes `c.var.email`.

```ts
new Email({
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: {
    user: 'noreply@example.com',
    pass: 'secret',
  },
  from: 'noreply@example.com',
  tls: {
    rejectUnauthorized: false,
  },
});
```

| Option | Meaning |
| --- | --- |
| `host` | SMTP host. |
| `port` | SMTP port. |
| `secure` | Whether to use secure SMTP. |
| `auth.user` | SMTP username. |
| `auth.pass` | SMTP password. |
| `from` | Sender address. Defaults to `from` or `auth.user`. |
| `tls.rejectUnauthorized` | TLS certificate verification flag. |

Email send parameters:

| Parameter | Meaning |
| --- | --- |
| `to` | Recipient email. Required. |
| `template` | Template name from `TheAPI({ emailTemplates })`. |
| `data` | Data object compiled into Handlebars templates. |
| `subject` | Subject override or direct subject. |
| `text` | Text body override or direct text body. |
| `html` | HTML body override or direct HTML body. |

### What response fields should clients always expect?

The response envelope is stable:

```json
{
  "result": {},
  "relations": {},
  "meta": {},
  "error": false,
  "requestTime": 4,
  "serverTime": "2026-03-05T13:47:54.709Z",
  "logId": "abcd1234"
}
```

Some fields can be absent when unused:

- `relations` is present when relation middleware sets it.
- `meta` is present for list responses or custom handlers that set it.
- `requestTime` can be absent in certain error paths handled outside normal
  route formatting.

## Reference guide

The rest of this file is the deeper working guide for agents and developers who
use `the-api` as a module for building APIs in different applications, or who
change this package itself. If the question is "how should X be done here", read
this file first, then `README.md`, then the tests.

## Core idea

`the-api` is an npm/Bun package for quickly building REST APIs on top of Hono,
PostgreSQL/Knex, and `the-api-routings`.

A normal application should not copy code from this repository. It should import
the package as a module:

```ts
import { Routings, TheAPI, middlewares } from 'the-api';
```

The application then creates its own routes and CRUD definitions, passes them to
`TheAPI`, and `the-api` handles:

- starting the Hono application;
- the unified JSON response envelope;
- body, query, and request state parsing;
- JWT user state;
- PostgreSQL connection and migrations;
- CRUD endpoints through `router.crud(definition)`;
- roles and permissions through `the-api-roles`;
- common middleware: logs, errors, status;
- optional middleware: files, email, info, cors, csrf, compress, etag,
  bodyLimit.

## Quick start in this repository

Main commands:

```bash
bun test
bun test tests/crud/simple.spec.ts
bun run build
```

Database tests need PostgreSQL. This repository includes a compose file:

```bash
docker compose -f tests/docker-compose.yml up -d
```

Test environment variables live in `.env.test`. If the environment is not loaded
automatically, run tests explicitly:

```bash
bun --env-file=.env.test test
```

Build output is written to `dist/` as runtime JS and `.d.ts` files. Do not edit
`dist/` manually. Change `src/` and run `bun run build`.

## Stack and layout

- Runtime: Bun 1+ and Node 18+.
- HTTP framework: Hono.
- Database: PostgreSQL through Knex.
- CRUD builder and router: `the-api-routings`.
- Roles: `the-api-roles`.
- Tests: `bun:test`, helpers in `src/testClient.ts`.

Key files:

- `src/index.ts` - public package exports.
- `src/TheApi.ts` - lifecycle, middleware/routes registration, DB, roles.
- `src/Db.ts` - Postgres connection, migrations, table introspection.
- `src/types.ts` - public types.
- `src/crudConfig.ts` - CRUD field rules normalization.
- `src/Validatior.ts` - runtime validation for CRUD params/query/body/headers.
- `src/requestState.ts` - normalized query and parsed body.
- `src/middlewares/` - built-in middleware.
- `src/Files.ts` - local/MinIO uploads and image variants.
- `src/Email.ts` - nodemailer plus Handlebars templates.
- `tests/` - behavioral contract. When in doubt, check the tests.

## Public package API

Exports come from `src/index.ts`:

```ts
export { cors } from 'hono/cors';
export { csrf } from 'hono/csrf';
export { compress } from 'hono/compress';
export { etag } from 'hono/etag';
export { bodyLimit } from './bodyLimit';
export { Routings } from 'the-api-routings';
export { TheAPI } from './TheApi';
export { Db } from './Db';
export { Email } from './Email';
export { Files } from './Files';
export * from './testClient';
export * as middlewares from './middlewares';
export * from './Validatior';
export * from './types';
```

The usual application entry point looks like this:

```ts
import { Routings, TheAPI, middlewares } from 'the-api';

const router = new Routings({ migrationDirs: ['./migrations'] });

router.get('/health', async (c) => {
  c.set('result', { ok: true });
});

router.crud({ table: 'messages' });

const theAPI = new TheAPI({
  routings: [middlewares.common, router],
});

await theAPI.up();
```

For a Bun server:

```ts
export default await theAPI.upBun();
```

## `TheAPI` lifecycle

`new TheAPI(options)` only stores configuration. The real setup happens in
`init()`, `up()`, or `upBun()`.

`TheAPI` does the following:

1. Collects `routesErrors` and `routesEmailTemplates` from all routings.
2. Registers global middleware for error, template, and roles lookup.
3. If `DB_HOST` or `DB_WRITE_HOST` is set, creates `Db`, waits for connection,
   runs migrations, and puts `db`, `dbWrite`, and `dbTables` into request
   context.
4. Registers `beginRoute`, roles route, `relationsRoute`, user routings, and
   `endRoute`.

Options:

```ts
type TheApiOptionsType = {
  routings: RoutingsInputType;
  roles?: Roles;
  emailTemplates?: Record<string, EmailTemplatesType>;
  port?: number;
  migrationDirs?: string[];
};
```

`routings` can contain `Routings` instances and arrays of `Routings`. They are
flattened internally.

`destroy()` closes DB pools. Call it at the end of tests and long-running
scripts that create a `TheAPI` instance.

## How applications should connect CRUD definitions

The preferred application pattern is to keep each CRUD definition next to its
domain module and import it into the application router.

Example from `/home/ivanoff/work/ships.trade/api/src/modules/ships/definition.js`:

```js
const { IMAGE_SHOW_LIMIT: imageShowLimit } = process.env;

/** @type {import('the-api-routings').CrudBuilderOptionsType} */
const definition = {
  table: 'ships',
  join: [
    {
      table: 'images',
      where: '"ships"."id" = "images"."shipId"',
      fields: ['id', 'name', 'originalName', 'path'],
      orderBy: '"isMain" DESC, "id" ASC',
      limit: Number(imageShowLimit) || 1,
    },
    { table: 'categories', where: '"categories"."id" = "ships"."categoryId"' },
    {
      table: 'lang',
      alias: 'nameLang',
      where: '"lang"."lang" = :l AND "lang"."key" = "ships"."name"',
      whereBindings: { l: 'query._lang' },
    },
    {
      table: 'users',
      where: '"users"."id" = "ships"."userId"',
      fields: [
        'companyCountry',
        'companyId',
        'companyName',
        'firstName',
        'secondName',
        'id',
        'position',
        'product',
        'statuses',
      ],
    },
    {
      table: 'regions',
      alias: 'region',
      where: '"regions"."id" = "ships"."regionId"',
      fields: ['id', 'name'],
    },
  ],
  hiddenFields: ['externalCompanyName', 'externalId', 'externalUrl'],
  requiredFields: {
    categoryId: 'CATEGORY_ID_IS_REQUIRED',
  },
  userIdFieldName: 'userId',
  defaultWhere: { deleted: false, sold: false },
  readOnlyFields: [
    'id',
    'userId',
    'timeCreated',
    'timeUpdated',
    'deleted',
    'status',
    'hasPdf',
    'hasRtf',
    'impressionsTotal',
    'viewsTotal',
  ],
};

export default definition;
```

Application connection:

```ts
import { Routings, TheAPI, middlewares } from 'the-api';
import shipsDefinition from './modules/ships/definition.js';

const api = new Routings({ migrationDirs: ['./migrations'] });

api.crud(shipsDefinition);

const theAPI = new TheAPI({
  routings: [middlewares.common, api],
});

await theAPI.up();
```

If an application module has several entities, create one `Routings` instance
for the module or for a group of related modules, not one huge global file.

## CRUD definition: main fields

Minimum:

```ts
router.crud({ table: 'messages' });
```

Common `CrudBuilderOptionsType` fields:

- `table` - table name, required.
- `prefix` - URL prefix instead of the table name.
- `schema` - DB schema.
- `aliases` - output/input field aliases.
- `join` - joined data that is always available.
- `joinOnDemand` - joined data that is available only through `_join`.
- `lang`, `translate` - localization/translation support.
- `searchFields` - fields used by `_search`.
- `requiredFields` - legacy required fields config.
- `fieldRules` - modern hidden/readOnly/role-based field config.
- `permissions` - which CRUD methods should be protected by permissions.
- `defaultWhere` - permanent filter.
- `defaultWhereRaw` - raw SQL filter.
- `defaultSort` - default sorting.
- `sortRaw` - raw sorting.
- `fieldsRaw` - raw field selection.
- `includeDeleted` - include soft-deleted records in reads.
- `deletedReplacements` - values substituted for deleted records.
- `relations` - related datasets moved into top-level `relations`.
- `relationIdName` - id field name for relations.
- `userIdFieldName` - owner field name.
- `validation` - auto/custom validation settings.

The type in `src/types.ts` is broader and includes legacy fields. If you add new
behavior, check existing tests and the type first.

## CRUD join

Join item:

```ts
{
  table: 'images',
  schema: 'public',
  alias: 'images',
  as: 'images2',
  where: '"ships"."id" = "images"."shipId"',
  whereBindings: { l: 'query._lang' },
  defaultValue: '[]',
  fields: ['id', 'path'],
  field: 'name',
  orderBy: '"isMain" DESC, "id" ASC',
  limit: 1,
  leftJoin: ['otherTable', '"otherTable"."id"', '"images"."otherId"'],
  byIndex: 0,
  permission: 'ships.getImages',
}
```

Rules:

- Use quoted identifiers in raw SQL fragments: `"table"."field"`.
- `field` plus `alias` returns one field as a scalar value.
- `fields` returns an object or an array of objects.
- `limit: 1` with `byIndex: 0` is commonly used to return one object or `null`,
  not an array.
- `joinOnDemand` requires `_join=name` in the query. Without `_join`, on-demand
  join fields should not be available.
- `whereBindings` reads values from context paths like `query._lang` or
  `env._typeName`.

## CRUD GET all query parameters

Supported user query parameters:

- `_fields=name,typeId` - select response fields.
- `_join=typeName,testTypes` - enable `joinOnDemand`.
- `_sort=name` - ascending sort.
- `_sort=-name,-id` - descending by `name`, then descending by `id`.
- `_sort=random()` - random sort.
- `_limit=20` - limit.
- `_skip=40` - offset.
- `_page=2` - page number when `_limit` is set.
- `_after=...` - cursor pagination. `nextAfter` is returned in `meta`.
- `_search=text` - fuzzy search by `searchFields`.
- `field=value` - equality filter.
- `field=value&field=other` - OR for the same field.
- `field!=value` - not equal.
- `field~=value` - fuzzy/like-style filter.
- `_from_field=value` - `>=`.
- `_to_field=value` - `<=`.
- `_in_field=["a","b"]` - JSON array membership.
- `_not_in_field=["a","b"]` - inverse membership.
- `_null_field=true` - `IS NULL`.
- `_not_null_field=true` - `IS NOT NULL`.

For `_in_*` and `_not_in_*`, use a valid JSON array. Single quotes are not JSON
and should produce an error.

`meta` for list responses usually contains:

```json
{
  "total": 3,
  "limit": 20,
  "skip": 0,
  "page": 1,
  "nextPage": 2,
  "pages": 1,
  "after": "...",
  "nextAfter": "...",
  "isFirstPage": true,
  "isLastPage": false
}
```

## Field rules

Use `fieldRules` instead of legacy `hiddenFields`/`readOnlyFields` when writing
new configuration:

```ts
fieldRules: {
  hidden: ['password', 'salt'],
  readOnly: ['roles', 'email'],
  visibleFor: {
    'users.getFullInfo': ['email', 'externalProfiles'],
  },
  editableFor: {
    'users.editEmail': ['email'],
    'users.editRoles': ['roles'],
  },
}
```

Behavior:

- `hidden` hides fields in responses.
- `hidden` fields automatically become readonly.
- `readOnly` fields are ignored in POST/PATCH.
- `visibleFor` exposes hidden fields to users with a permission.
- `editableFor` allows readonly fields to be changed by users with a permission.
- The virtual `owner` role can receive owner-only permissions when the record
  belongs to the user.

`normalizeCrudConfig()` converts `fieldRules` into the format expected by
`the-api-routings`.

## Permissions and roles

Roles are connected through `the-api-roles`.

```ts
import Roles from 'the-api-roles';
import { TheAPI } from 'the-api';

const roles = new Roles({
  root: ['*'],
  admin: ['_.registered', 'testNews.*'],
  registered: ['testNews.get'],
  owner: ['testNews.patch', 'testNews.delete'],
  guest: ['testNews.get'],
});

const theAPI = new TheAPI({ routings: [router], roles });
```

CRUD permissions:

```ts
router.crud({
  table: 'testNews',
  permissions: {
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});
```

Shortcut:

```ts
permissions: { methods: ['*'] }
```

Rules:

- CRUD permission format is `<prefix-or-table>.<methodLowerCase>`, for example
  `ships.get`, `ships.post`, `ships.patch`, `ships.delete`.
- If `prefix` is set, permissions use the prefix.
- If `permissions.methods` is set, only the listed methods are protected.
- If `permissions.methods` is not set but roles contain permissions such as
  `users.delete`, `TheAPI` automatically protects the matching CRUD methods.
- `POST` and collection `GET` are registered on `/prefix`.
- record `GET`, `PATCH`, and `DELETE` are registered on `/prefix/:id`.
- Requests without a token get user `{ roles: ['guest'] }`.
- A token without `roles` is not treated as guest.
- For owner checks, `TheAPI` preloads the object from DB and puts it into
  `objectToCheck`.

## Validation

CRUD validation can be automatic or custom.

By default, the schema is built from `dbTables`, which `Db` gets through
PostgreSQL introspection:

- required fields come from `is_nullable = NO`;
- number/string/date/boolean come from column types;
- min/max/enum come from simple check constraints and enum types;
- `id`, generated/default columns, and readonly fields are not required in POST.

Disable all validation:

```ts
validation: {}
```

Disable only params validation:

```ts
validation: {
  params: {},
}
```

Custom body schema:

```ts
validation: {
  body: {
    post: {
      warningLevel: { type: 'number', min: 1, max: 3 },
      body: { type: 'string', required: true },
    },
    patch: {
      warningLevel: { type: 'number', max: 5 },
    },
  },
}
```

A schema section can be a function:

```ts
validation: {
  body: {
    post: (c) => ({
      name: { type: 'string', required: true },
    }),
  },
}
```

A validation error returns `VALIDATION_ERROR` with status `400`, code `22`, and
details in `result.additional`.

## Request context

Use `c.var` or Hono `c.get()`/`c.set()` in handlers.

At the beginning of every request, `beginRoute` sets:

- `log(...args)` - request-scoped logger.
- `error(err)` - unified error setter.
- `appendQueryParams(params)` - change query params for following handlers.
- `query` - normalized query params.
- `body` - parsed body.
- `bodyType` - `empty`, `json`, `form`, `text`, or `arrayBuffer`.
- `user` - JWT user or guest user.
- `result` - value that will be placed into the response.
- `meta`, `relations`, `relationsData`, `logId`.

Body parsing:

- JSON content type -> object, or `{}` for malformed JSON.
- form/multipart -> plain object, repeated keys become arrays.
- text -> string.
- other body -> `ArrayBuffer`.

Example middleware that changes query:

```ts
router.get('/query', async (c, next) => {
  c.var.appendQueryParams({
    userId: c.var.user.userId,
    modified: true,
    removeMe: null,
  });
  await next();
});
```

## Response contract

All normal responses are formatted like this:

```json
{
  "result": {},
  "relations": {},
  "meta": {},
  "error": false,
  "requestTime": 4,
  "serverTime": "2026-03-05T13:47:54.709Z",
  "logId": "abcd1234"
}
```

Rules:

- A handler should put data into `c.set('result', value)`.
- If `result.error` exists, top-level `error` uses that value.
- If `result` is not set, the response becomes `NOT_FOUND`.
- `relations` and `meta` appear when middleware/CRUD sets them.
- Do not return `Response` directly from normal handlers if you want to keep the
  unified envelope. Special middleware such as `bodyLimit` is an exception.

Errors:

```ts
router.errors({
  CATEGORY_ID_IS_REQUIRED: {
    code: 1001,
    status: 400,
    description: 'Category id is required',
  },
});
```

Usage:

```ts
throw new Error('CATEGORY_ID_IS_REQUIRED');
```

Additional information:

```ts
throw Object.assign(new Error('CATEGORY_ID_IS_REQUIRED'), {
  additional: [{ message: 'categoryId is empty', field: 'categoryId' }],
});
```

## Built-in middleware

`middlewares.common`:

```ts
const common = [logs, errors, status];
```

What it does:

- `logs` logs begin/end, hides password/token/authorization-like fields, and
  sets `logId`.
- `errors` expands `c.var.error`, adds stack, and uses DEFAULT fallback.
- `status` adds `GET /status -> { ok: 1 }`.

Additional middleware:

- `middlewares.info` - `GET /info`, uptime, totalRequests, package name/version.
- `middlewares.email` - sets `c.var.email`.
- `middlewares.files` - sets `c.var.files`.
- `middlewares.createFiles(options)` - files middleware with explicit options.
- `cors`, `csrf`, `compress`, `etag` - re-exported from Hono.
- `bodyLimit({ maxSize })` - Hono body limit with API-shaped 413 response.

Connection:

```ts
const theAPI = new TheAPI({
  routings: [
    middlewares.common,
    middlewares.info,
    middlewares.files,
    middlewares.email,
    router,
  ],
});
```

Order matters. Common middleware should usually be placed before user routes.

## Files

`Files` works with a local folder or MinIO.

Local config:

```env
FILES_FOLDER=public/files
```

MinIO config:

```env
MINIO_ENDPOINT=minio.example.com
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET_NAME=...
```

Image variants:

```env
IMAGE_SIZES=thumb:200x200,large:1200x800
IMAGE_NAME_LENGTH_BYTES=16
```

Usage in a route:

```ts
router.post('/upload', async (c) => {
  const uploads = await c.var.files.uploadBody(
    c.var.body as Record<string, unknown>,
    'ships',
    { fields: ['file', 'file[]'], imagesOnly: true },
  );

  c.set('result', uploads);
});
```

Files middleware errors:

- `FILES_INVALID_FILE` -> 400.
- `FILES_NO_STORAGE_CONFIGURED` -> 500.
- `FILES_NO_MINIO_CONFIGURED` -> 500.
- `FILES_INVALID_IMAGE_SIZES_CONFIG` -> 500.

## Email

Env:

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_FROM=noreply@example.com
EMAIL_USER=...
EMAIL_PASSWORD=...
EMAIL_SECURE=false
EMAIL_TLS_REJECTUNAUTH=false
```

Templates can be passed to `TheAPI`:

```ts
const theAPI = new TheAPI({
  routings: [middlewares.email, router],
  emailTemplates: {
    welcome: {
      subject: 'Welcome, {{name}}',
      text: 'Hello {{name}}',
    },
  },
});
```

Usage:

```ts
await c.var.email({
  to: 'user@example.com',
  template: 'welcome',
  data: { name: 'Ivan' },
});
```

If there is no `subject`, or if neither `text` nor `html` is provided, the
middleware throws `EMAIL_REQUIRES_FIELDS`.

## Database and migrations

`Db` reads env:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
DB_SCHEMA=public
DB_POOL_MIN=1
DB_POOL_MAX=10

DB_WRITE_HOST=localhost
DB_WRITE_PORT=5432
DB_WRITE_USER=postgres
DB_WRITE_PASSWORD=postgres
DB_WRITE_DATABASE=postgres
DB_WRITE_SCHEMA=public
DB_WRITE_POOL_MIN=1
DB_WRITE_POOL_MAX=10

DB_TRGM_SIMILARITY_THRESHOLD=0.1
```

If `DB_WRITE_HOST` is not set, `dbWrite === db`.

During init:

- read and write connections are checked;
- migrations run through Knex `migrate.latest`;
- `pg_trgm.similarity_threshold` is set;
- introspection stores metadata in `dbTables`.

Migration dirs come from:

- `TheAPI({ migrationDirs })`;
- `new Routings({ migrationDirs })`;
- built-in migration directory `src/migrations`.

New application migrations should live in the application, not in this package,
unless the built-in infrastructure of `the-api` itself is changing.

## Routes

`Routings` comes from `the-api-routings`.

Normal routes:

```ts
router.get('/data/:id', async (c) => {
  const { id } = c.req.param();
  c.set('result', { id });
});

router.post('/data', async (c) => {
  c.set('result', c.var.body);
});

router.patch('/data/:id', async (c) => {
  c.set('result', { id: c.req.param('id'), patch: c.var.body });
});

router.delete('/data/:id', async (c) => {
  c.set('result', { ok: true });
});
```

Middleware route:

```ts
router.use('*', async (c, next) => {
  c.var.log('before');
  await next();
});
```

If several handlers are needed for one path, register them sequentially in the
same `Routings`; Hono will run the chain in registration order.

## Relations response

`relationsRoute` looks at `c.var.relationsData` after the handler/CRUD has run,
finds ids in `result`, loads related datasets through `CrudBuilder`, and stores
them in top-level `relations`.

Use `relations` in a CRUD definition when the client needs a normalized
response: the main `result` contains ids, while full objects are returned
separately in `relations`.

## Soft delete

CRUD delete usually does not physically delete a row. It sets a deleted marker
when the table supports `timeDeleted` or `isDeleted`.

Behavior from tests:

- normal GET requests hide deleted records;
- `includeDeleted: true` allows reading deleted records;
- `deletedReplacements` replaces fields on deleted records in the response;
- hidden fields stay hidden for deleted records;
- aliases continue to work.

Example:

```ts
router.crud({
  table: 'testNews',
  includeDeleted: true,
  deletedReplacements: {
    name: 'Deleted News',
  },
});
```

## Tests for changes

For new behavior, add focused tests next to similar ones:

- CRUD base: `tests/crud/simple.spec.ts`.
- Fields/join/search/sort/filter/pagination: `tests/crud/*.spec.ts`.
- Permissions: `tests/crud/permissions/*.spec.ts`.
- Request state: `tests/request-state.spec.ts`.
- Middleware: `tests/*middleware*.spec.ts` or a top-level spec.
- Files/email/body-limit/cors/csrf/compress/etag have their own specs.

Use the helper:

```ts
import { testClient } from '../lib';

const { client, theAPI, tokens, users, db, DateTime } = await testClient({
  migrationDirs: ['./tests/migrations'],
  crudParams: [{ table: 'testNews' }],
  roles: {
    root: ['*'],
    guest: ['testNews.get'],
  },
});
```

`testClient()`:

- drops tables before init;
- creates `TheAPI`;
- calls `theAPI.init()`;
- returns an isolated `TestClient`;
- registers `afterAll`, which cleans tables and calls `destroy()`.

HTTP helpers:

```ts
await client.get('/testNews');
await client.post('/testNews', { name: 'x' }, tokens.root);
await client.patch('/testNews/1', { name: 'y' });
await client.delete('/testNews/1');
await client.postForm('/upload', { file });
```

For raw `Request`, use:

```ts
await theAPI.app.fetch(new Request('http://localhost:7788/path'));
```

## Code change rules

- Preserve the public response envelope contract.
- Do not break applications that import `the-api` as a module.
- For new options, add types in `src/types.ts` first.
- For CRUD behavior, add or update tests.
- Do not introduce breaking changes to `CrudBuilderOptionsType` without an
  explicit reason.
- Do not edit `dist/` manually.
- Do not add runtime dependencies unless they are necessary.
- Use the existing TypeScript style: semicolons, named exports, small helpers
  close to where they are used.
- For DB SQL, prefer Knex/raw bindings. Raw SQL fragments in CRUD definitions
  should be local and quoted.
- For new middleware, return data through `c.set('result', ...)` to preserve the
  unified envelope.
- Register expected business errors through `router.errors(...)`.
- If auth, roles, or owner behavior changes, always check permissions tests.

## What counts as public contract

Public contract:

- exports from `src/index.ts`;
- shape of `TheApiOptionsType`;
- shape of `CrudBuilderOptionsType`;
- response envelope;
- CRUD query parameters;
- roles/permissions behavior;
- env variables;
- test helpers, because consumer packages may use them.

Private class methods and local helper functions can be treated as internal, but
change them carefully: tests may lock their behavior indirectly.

## Env reference

Core:

```env
PORT=7788
JWT_SECRET=test
JWT_EXPIRES_IN=1h
LOGS_SHOW_RESPONSE_SIZE_ONLY=false
```

Database:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
DB_SCHEMA=public
DB_POOL_MIN=1
DB_POOL_MAX=10
DB_WRITE_HOST=localhost
DB_WRITE_PORT=5432
DB_WRITE_USER=postgres
DB_WRITE_PASSWORD=postgres
DB_WRITE_DATABASE=postgres
DB_WRITE_SCHEMA=public
DB_WRITE_POOL_MIN=1
DB_WRITE_POOL_MAX=10
DB_TRGM_SIMILARITY_THRESHOLD=0.1
```

Files:

```env
FILES_FOLDER=public/files
IMAGE_SIZES=thumb:200x200,large:1200x800
IMAGE_NAME_LENGTH_BYTES=16
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET_NAME=...
```

Email:

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_FROM=noreply@example.com
EMAIL_USER=...
EMAIL_PASSWORD=...
EMAIL_SECURE=false
EMAIL_TLS_REJECTUNAUTH=false
```

## Decision guide

If you need to build an application API:

1. Create a module-level `definition.js` or `definition.ts`.
2. Describe `table`, `join`, `fieldRules`, `permissions`, `defaultWhere`, and
   `validation`.
3. Import the definition into the application router.
4. Connect the router through `new TheAPI({ routings: [...] })`.
5. Add application migrations in the app-level `migrations` directory.
6. Cover non-standard rules with application tests or package tests.

If you need to add a feature to `the-api`:

1. Find the closest existing test.
2. Add a failing test.
3. Change `src/`.
4. Update types.
5. Run the focused test.
6. Run `bun run build`.

If it is unclear where code should live:

- App-specific table fields, joins, filters, permissions -> the application.
- Generic REST/CRUD behavior -> `the-api`.
- Generic route builder behavior -> probably `the-api-routings`, not here.
- Generic role resolver behavior -> probably `the-api-roles`, not here.

## Final task checklist

- Changes follow the module-first approach: applications import the package
  rather than copying its code.
- Public exports and types are not broken.
- Response envelope is preserved.
- Errors have clear codes/statuses.
- Tests were added, or the reason for not adding tests is clear.
- `bun run build` passes for TypeScript changes.
- Documentation/examples were updated if public behavior changed.
