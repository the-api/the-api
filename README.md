# the-api

## Example

```typescript
import { Routings, TheAPI } from 'the-api';

const router = new Routings();

router.get('/data/:id', async (c) => { // hono routing
  const { id } = c.req.param();        // get route parameter
  c.set('result', { id, foo: 'bar' }); // set response result
});

const theAPI = new TheAPI({ routings: [router] });

await theAPI.up(); // use with node

// export default await theAPI.upBun(); // ...or use with bun
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
        "additional": ""
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

### errors

Every exception generates error response with `error` flag set to `true`

Also, error response contains code of error, response status code, main message, additional description and comments and stack.

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
        "additional": "",
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
        "additional": "additional information",
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
    additional: "",
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
