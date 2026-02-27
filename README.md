# the-api

## Example

```typescript
import { TheAPI } from 'the-api';

const theAPI = new TheAPI();
export default theAPI.up();
```

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```


```typescript
import { status } from '../extensions';

const router = new Routings();

router.post('/data/:id', async (c: Context) => {
  const body = await c.req.json();
  c.var.log('incoming data', body);

  c.set('result', {...c.req.param(), token: 'xxx', refresh: 'yyy'});
});

const theAPI = new TheAPI({ routings: [logs, status, router] });
export default theAPI.up();
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

### Put route

router.put('/put/:id', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', {...c.req.param(), ...body});
});

### Delete route

router.delete('/patch/:id', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', body);
});

## Logs middleware

```typescript
import { logs } from '../extensions';

const router = new Routings();

router.post('/data/:id', async (c: Context) => {
  const body = await c.req.json();
  c.var.log('incoming data', body);

  c.set('result', {...c.req.param(), token: 'xxx', refresh: 'yyy'});
});

const theAPI = new TheAPI({ routings: [logs, router] });
export default theAPI.up();
```

```
POST /data/12 {"password":"1"}
```

Log example:

```
[2024-05-18T12:30:33.837Z] [du69kxxq] [POST] [/data/12] [0] [begin]
[2024-05-18T12:30:33.837Z] [du69kxxq] [POST] [/data/12] [0] {"headers":{"content-type":"application/json"},"query":{},"body":{"password":"<hidden>"},"ip":null,"method":"POST","path":"/data/12"}
[2024-05-18T12:30:33.837Z] [du69kxxq] [POST] [/data/12] [0] incoming data
[2024-05-18T12:30:33.837Z] [du69kxxq] [POST] [/data/12] [0] {"password":"<hidden>"}
[2024-05-18T12:30:33.838Z] [du69kxxq] [POST] [/data/12] [1] {"id":"12","token":"<hidden>","refresh":"<hidden>"}
[2024-05-18T12:30:33.838Z] [du69kxxq] [POST] [/data/12] [1] [end]
```

data and time, unique request id, method, path, time on server, log information

each request starts with [begin] and ends with [end]

after begin you can see information about request

The following keys will mark as hidden: 'password', 'token', 'refresh', 'authorization'

you can use `c.var.log()` to add any info to logs

## Error middleware

Every exception generates error response with `error` flag set to `true`

Also, error response contains code of error, response status code, main message, additional description and comments and stack.

```typescript
import { errors } from '../extensions';

const router = new Routings();

router.get('/error', async (c: Context) => {
  throw new Error('error message');
});

const theAPI = new TheAPI({ routings: [errors, router] });
export default theAPI.up();
```

```javascript
{
  result: {
    code: 11,
    status: 500,
    description: "An unexpected error occurred",
    message: "error message",
    additional: "",
    stack: "...stack...",
    error: true,
  },
  error: true,
  requestTime: 1,
  serverTime: "2024-05-18T08:17:56.929Z",
  logId: "06zqxkyb",
}
```

### 404 Not Found

```javascript
{
  result: {
    code: 21,
    status: 404,
    description: "Not found",
    message: "NOT_FOUND",
    additional: "",
    error: true,
  },
  error: true,
  requestTime: 0,
  serverTime: "2024-05-18T16:56:21.501Z",
}
```

### User-defined errors

```typescript
router.get('/user-defined-error', async (c: Context) => {
  throw new Error('USER_DEFINED_ERROR');
});

router.errors({
  USER_DEFINED_ERROR: {
    code: 55,
    status: 403,
    description: 'user defined error',
  },
  ANOTHER_USER_DEFINED_ERROR: {
    code: 57,
    status: 404,
  },
});
```

```javascript
{
  result: {
    code: 55,
    status: 403,
    description: "user defined error",
    message: "USER_DEFINED_ERROR",
    additional: "",
    stack: "...stack...",
    error: true,
  },
  error: true,
  requestTime: 0,
  serverTime: "2024-05-18T10:39:49.795Z",
  logId: "06zqxkyb",
}
```

### Error with additional information

```typescript
router.errors({
  USER_DEFINED_ERROR: {
    code: 55,
    status: 403,
    description: 'user defined error',
  },
});

router.get('/user-defined-error-addition', async (c: any) => {
  try {
    c.some.path();
  } catch (err) {
    throw new Error('USER_DEFINED_ERROR: additional information');
  }
});
```

```javascript
{
  result: {
    code: 55,
    status: 403,
    description: "user defined error",
    message: "USER_DEFINED_ERROR",
    additional: "additional information",
    stack: "...",
    error: true,
  },
  error: true,
  requestTime: 1,
  serverTime: "2024-05-18T11:09:04.163Z",
}
```


### Error with meta information

```typescript
router.get('/user-defined-error-message-meta', async (c: any) => {
  try {
    c.some.path();
  } catch {
    c.set('meta', { x: 3 });
    throw new Error('error message');
  }
});
```

```javascript
{
  result: {
    code: 11,
    status: 500,
    description: "An unexpected error occurred",
    message: "error message",
    additional: "",
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

## Status middleware

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
