==== user ====
нужно написать фреймворк для быстрого создания REST API:
- bun, typescript
- PostgreSQL (через Knex.js)
- Hono
- convention over configuration для типовых CRUD-сервисов

==== assistant ====

## Архитектура

```
TheAPI (оркестратор)
├── Hono (HTTP-сервер, RegExpRouter)
├── Db (PostgreSQL, read/write splitting, миграции)
├── Middlewares (цепочка: begin → roles → relations → [пользовательские] → end)
├── Email (nodemailer + Handlebars шаблоны)
└── Files (локальная FS + MinIO)
```

## Ключевые компоненты

### `TheAPI` — точка входа
- Собирает маршруты, ошибки, email-шаблоны из всех переданных `Routings`
- Инициализирует БД (ожидание соединения, миграции)
- Формирует цепочку middleware: `begin → roles → relations → [user routes] → end`
- JWT-авторизация из заголовка `Authorization`
- Стандартизированный формат ответа: `{ result, relations, meta, error, requestTime, serverTime, logId }`

### `Db` — база данных
- **Read/Write splitting**: отдельные пулы для чтения (`DB_*`) и записи (`DB_WRITE_*`)
- Автомиграции при старте (собирает `migrationDirs` из всех routings)
- Интроспекция таблиц: получает схему, колонки, foreign keys
- Поддержка pg_trgm (полнотекстовый поиск)
- Переподключение каждые 5 сек при недоступности БД

### `Email` — отправка почты
- nodemailer-транспорт, конфигурация через `.env`
- Handlebars-шаблонизация (`subject`, `text`, `html`)
- Именованные шаблоны, передаваемые через `routesEmailTemplates`

### `Files` — работа с файлами
- Локальная файловая система (стриминговая запись)
- MinIO (частично реализовано — upload закомментирован, delete работает)

## Система middlewares

| Middleware | Назначение |
|------------|-----------|
| **default** (`beginRoute`/`endRoute`) | JWT-парсинг, формирование JSON-ответа, базовые ошибки (404, 403, 401, 500) |
| **errors** | Перехват исключений → структурированный error-ответ с `code`, `status`, `description`, `stack` |
| **logs** | Логирование запросов/ответов, уникальный `logId`, скрытие sensitive-полей (`password`, `token`, `refresh`, `authorization`) |
| **status** | `GET /status` → `{ ok: 1 }` (healthcheck) |
| **info** | `GET /info` → uptime, totalRequests, name, version |
| **email** | Инжектирует `c.var.email()` для отправки писем из обработчиков |
| **files** | Инжектирует `c.var.files` (экземпляр `Files`) |
| **relations** | Post-processing: подгружает связанные сущности по foreign keys через `flattening` |

## Система ошибок

- `throw new Error('ERROR_CODE')` → автоматическая трансформация в структурированный ответ
- `throw new Error('ERROR_CODE: дополнительная информация')` — с additional
- Пользовательские ошибки регистрируются через `router.errors({ ... })`
- Все ошибки агрегируются из всех routings при инициализации

## Тестовое покрытие (17+ spec-файлов)

- CRUD: фильтрация, пагинация, сортировка, поиск, join, relations, soft-delete
- Permissions: роли, hidden/readonly поля, защищённые методы
- Инфраструктура: DB, email, files, errors, info/status, langs
- Docker Compose для тестовой PostgreSQL

## Характерные особенности

1. **Convention over configuration** — минимум кода для типовых REST API
2. **Декларативный CRUD** через `CrudBuilder` (внешний пакет `the-api-routings`)
3. **Read/Write splitting** из коробки
4. **Plug-in архитектура** — middlewares подключаются как `Routings`
5. **Единый формат ответа** для всех эндпоинтов (включая ошибки)
6. **Автоскрытие чувствительных данных** в логах

---

==== user ====
Покажи структуру проекта и ключевые файлы.

==== assistant ====

## Project Structure

src
├── Db.ts
├── Email.ts
├── Files.ts
├── index.ts
├── middlewares
│   ├── default.ts
│   ├── email.ts
│   ├── errors
│   │   ├── errorList.ts
│   │   └── index.ts
│   ├── files.ts
│   ├── index.ts
│   ├── info.ts
│   ├── logs.ts
│   ├── relations.ts
│   └── status.ts
├── migrations
│   └── 20240525120021_init.js
├── TheApi.ts
└── types.ts
test
├── core.dist.spec.ts
├── core.spec.ts
├── crud
│   ├── after.spec.ts
│   ├── deleted.spec.ts
│   ├── fieldsDeleted.spec.ts
│   ├── fieldsHiddenReadonly.spec.ts
│   ├── fields.spec.ts
│   ├── filter.spec.ts
│   ├── join.spec.ts
│   ├── pagination.spec.ts
│   ├── permissions
│   │   ├── hidden.spec.ts
│   │   ├── methods.spec.ts
│   │   └── roles.spec.ts
│   ├── relations.spec.ts
│   ├── search.spec.ts
│   ├── simple.spec.ts
│   └── sort.spec.ts
├── db
│   └── db.spec.ts
├── docker-compose.yml
├── email.spec.ts
├── errors.spec.ts
├── files.spec.ts
├── info.status.spec.ts
├── init.ts
├── langs.spec.ts
├── lib.ts
├── migrations
│   └── 20240525312745_init.js
├── static
│   └── 123.txt
├── types.ts
└── uploads
    └── 123.txt

9 directories, 47 files

## Key Files

### README.md
```markdown
# moduler

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
```

### package.json
```json
{
  "name": "the-api",
  "version": "22.0.1",
  "license": "MIT",
  "author": "Dimitry Ivanov <2@ivanoff.org.ua> # curl -A cv ivanoff.org.ua",
  "description": "The API - Create Your API in Seconds",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "test": "bun test --preload ./test/init.ts",
    "build": "bun build ./src/index.ts --outdir ./dist --target node --minify --external luxon --external knex --external pg --external jsonwebtoken --external hono --external flattening --external @types/node --external @types/bun && tsc"
  },
  "dependencies": {
    "flattening": "^2.4.3",
    "handlebars": "^4.7.8",
    "hono": "^4.12.2",
    "jsonwebtoken": "^9.0.3",
    "knex": "^3.1.0",
    "luxon": "^3.7.2",
    "minio": "^8.0.6",
    "nodemailer": "^8.0.1",
    "pg": "^8.19.0",
    "the-api-routings": "^0.5.2"
  },
  "devDependencies": {
    "@types/bun": "^1.3.9",
    "@types/node": "^25.3.1",
    "@types/nodemailer": "^7.0.11",
    "the-api-langs": "^0.1.1",
    "the-api-roles": "^0.1.1"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/the-api/the-api"
  },
  "keywords": [
    "THE API",
    "API",
    "REST"
  ],
  "engines": {
    "node": ">=18",
    "bun": ">=1"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "./dist",
    "skipLibCheck": true
  },
  "include": [
    "src/**/*.ts"
  ]
}
```

### .env.example
```env
JWT_SECRET=test
JWT_EXPIRES_IN=1h

DB_HOST=localhost
DB_PORT=6433
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
DB_POOL_MIN=2
DB_POOL_MAX=2

DB_WRITE_HOST=localhost
DB_WRITE_PORT=6434
DB_WRITE_USER=postgres
DB_WRITE_PASSWORD=postgres
DB_WRITE_DATABASE=postgres
DB_WRITE_POOL_MIN=2
DB_WRITE_POOL_MAX=2

EMAIL_HOST=ships.trade
EMAIL_PORT=587
EMAIL_FROM=noreply@battlepro.com
EMAIL_USER=no-reply@ships.trade
EMAIL_PASSWORD=q
EMAIL_TLS_REJECTUNAUTH=false

FILES_FOLDER=public/files

MINIO_ENDPOINT=minio.your-server.com
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=Rq...p3
MINIO_SECRET_KEY=DD...Qa
MINIO_BUCKET_NAME=prod
```

### .gitignore
```gitignore
# Based on https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore

# Logs

logs
_.log
npm-debug.log_
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Caches

.cache

# Diagnostic reports (https://nodejs.org/api/report.html)

report.[0-9]_.[0-9]_.[0-9]_.[0-9]_.json

# Runtime data

pids
_.pid
_.seed
*.pid.lock

# Directory for instrumented libs generated by jscoverage/JSCover

lib-cov

# Coverage directory used by tools like istanbul

coverage
*.lcov

# nyc test coverage

.nyc_output

# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)

.grunt

# Bower dependency directory (https://bower.io/)

bower_components

# node-waf configuration

.lock-wscript

# Compiled binary addons (https://nodejs.org/api/addons.html)

build/Release

# Dependency directories

node_modules/
jspm_packages/

# Snowpack dependency directory (https://snowpack.dev/)

web_modules/

# TypeScript cache

*.tsbuildinfo

# Optional npm cache directory

.npm

# Optional eslint cache

.eslintcache

# Optional stylelint cache

.stylelintcache

# Microbundle cache

.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history

.node_repl_history

# Output of 'npm pack'

*.tgz

# Yarn Integrity file

.yarn-integrity

# dotenv environment variable files

.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# parcel-bundler cache (https://parceljs.org/)

.parcel-cache

# Next.js build output

.next
out

# Gatsby files

# Comment in the public line in if your project uses Gatsby and not Next.js

# https://nextjs.org/blog/next-9-1#public-directory-support

# public

# vuepress build output

.vuepress/dist

# vuepress v2.x temp and cache directory

.temp

# Docusaurus cache and generated files

.docusaurus

# Serverless directories

.serverless/

# FuseBox cache

.fusebox/

# DynamoDB Local files

.dynamodb/

# TernJS port file

.tern-port

# Stores VSCode versions used for testing VSCode extensions

.vscode-test

# yarn v2

.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*

# IntelliJ based IDEs
.idea

# Finder (MacOS) folder config
.DS_Store
```

==== user ====
Теперь приложи исходники из src и test.

==== assistant ====

## Source Code

### src/Db.ts
```ts
import { existsSync, statSync } from 'fs';
import { knex } from 'knex';
import { FsMigrations } from 'knex/lib/migrations/migrate/sources/fs-migrations';
import type { Knex } from 'knex';
import type { DbOptionsType, DbTablesType, DbColumnInfo } from './types';

const {
  DB_HOST: host,
  DB_PORT: port,
  DB_USER: user,
  DB_PASSWORD: password,
  DB_DATABASE: database,
  DB_SCHEMA: schema,
  DB_POOL_MIN: poolMin = '1',
  DB_POOL_MAX: poolMax,
  DB_WRITE_HOST: hostWrite,
  DB_WRITE_PORT: portWrite,
  DB_WRITE_USER: userWrite,
  DB_WRITE_PASSWORD: passwordWrite,
  DB_WRITE_DATABASE: databaseWrite,
  DB_WRITE_SCHEMA: schemaWrite,
  DB_WRITE_POOL_MIN: poolWriteMin = '1',
  DB_WRITE_POOL_MAX: poolWriteMax,
} = process.env;

export class Db {
  public db: Knex;
  public dbWrite: Knex;
  public dbTables: DbTablesType = {};
  private migrationDirs: string[];
  private intervalDbCheck?: Timer;

  constructor(options?: DbOptionsType) {
    const { migrationDirs = [] } = options || {};

    const connection = {
      host,
      user,
      password,
      database,
      port: Number(port),
      ...(schema && { schema }),
    };

    const connectionWrite = {
      host: hostWrite,
      user: userWrite,
      password: passwordWrite,
      database: databaseWrite,
      port: Number(portWrite),
      ...(schemaWrite && { schema: schemaWrite }),
    };

    const pool = poolMax ? { min: +poolMin, max: +poolMax } : undefined;
    const poolWrite = poolWriteMax
      ? { min: +poolWriteMin, max: +poolWriteMax }
      : undefined;

    const defaultDbOptions = {
      client: 'pg',
      useNullAsDefault: true,
    };

    this.db = knex({ connection, ...defaultDbOptions, ...(pool && { pool }) });

    this.dbWrite = hostWrite
      ? knex({
          connection: connectionWrite,
          ...defaultDbOptions,
          ...(poolWrite && { pool: poolWrite }),
        })
      : this.db;

    this.migrationDirs = ([] as string[])
      .concat(migrationDirs)
      .filter((dirPath) => {
        try {
          return existsSync(dirPath) && statSync(dirPath).isDirectory();
        } catch {
          return false;
        }
      });
  }

  async waitDb(): Promise<void> {
    return new Promise((resolve) => {
      this.intervalDbCheck = setInterval(
        () => this.checkDb().then(resolve),
        5000,
      );
      this.checkDb().then(resolve);
    });
  }

  async checkDb(): Promise<void> {
    try {
      await this.db.raw('select 1+1 as result');
      await this.dbWrite.raw('select 1+1 as result');
      clearInterval(this.intervalDbCheck);
      console.log('DB connected');

      const migrationSource = new FsMigrations(this.migrationDirs, false);
      await this.dbWrite.migrate.latest({ migrationSource });
      console.log('Migration done');

      const thresholdRaw = Number(
        process.env.DB_TRGM_SIMILARITY_THRESHOLD ?? 0.1,
      );
      const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.1;
      await this.db.raw(`SET pg_trgm.similarity_threshold = ${threshold}`);
      await this.dbWrite.raw(`SET pg_trgm.similarity_threshold = ${threshold}`);

      this.dbTables = await this.introspectTables(this.dbWrite);
      console.log(`Tables found: ${Object.keys(this.dbTables)}`);
    } catch (err) {
      console.log('DB connection error:', err, 'waiting for 5 seconds...');
    }
  }

  async destroy(): Promise<void> {
    await this.db.destroy();
    if (this.dbWrite !== this.db) await this.dbWrite.destroy();
  }

  // -- private --

  private async introspectTables(db: Knex): Promise<DbTablesType> {
    const tablesQuery = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`;

    const { rows: tables } = await db.raw(tablesQuery);

    const refsQuery = `
      SELECT
        tc.table_schema, tc.constraint_name,
        tc.table_name, kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name   AS foreign_table_name,
        ccu.column_name  AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'`;

    const { rows: references } = await db.raw(refsQuery);

    const result: DbTablesType = {};

    await Promise.all(
      tables.map(
        async ({
          table_schema,
          table_name,
        }: {
          table_schema: string;
          table_name: string;
        }) => {
          const key = `${table_schema}.${table_name}`;
          const { rows: columns } = await db.raw(
            `SELECT * FROM information_schema.columns
             WHERE table_name = :table_name AND table_schema = :table_schema`,
            { table_name, table_schema },
          );

          result[key] = columns.reduce(
            (acc: Record<string, DbColumnInfo>, col: DbColumnInfo) => {
              acc[col.column_name] = {
                ...col,
                references: references.find(
                  (r: Record<string, string>) =>
                    r.table_name === table_name &&
                    r.column_name === col.column_name,
                ),
              };
              return acc;
            },
            {},
          );
        },
      ),
    );

    return result;
  }
}
```

### src/Email.ts
```ts
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import type { EmailParamsType, EmailConfig } from './types';

export class Email {
  private transport: nodemailer.Transporter;
  private from: string;

  constructor(config?: EmailConfig) {
    const {
      EMAIL_USER: user,
      EMAIL_PASSWORD: pass,
      EMAIL_FROM: from,
      EMAIL_HOST: host,
      EMAIL_PORT: port,
      EMAIL_SECURE: isSecure,
      EMAIL_TLS_REJECTUNAUTH: rejectUnauth,
    } = process.env;

    const envConfig: EmailConfig = {
      auth: { user, pass },
      from,
      host,
      port: port ? parseInt(port, 10) : undefined,
      secure: isSecure === 'true',
      tls:
        rejectUnauth !== undefined
          ? { rejectUnauthorized: rejectUnauth === 'true' }
          : undefined,
    };

    const finalConfig = config || envConfig;
    this.transport = nodemailer.createTransport(
      finalConfig as nodemailer.TransportOptions,
    );
    this.from = finalConfig.from || finalConfig.auth?.user || '';
  }

  async send({
    to,
    subject,
    text,
    html,
  }: Pick<EmailParamsType, 'to' | 'subject' | 'text' | 'html'>): Promise<nodemailer.SentMessageInfo> {
    return this.transport.sendMail({ from: this.from, to, subject, text, html });
  }

  compile(template: string | undefined, data: Record<string, unknown> = {}): string {
    return Handlebars.compile(template || '')(data);
  }
}
```

### src/Files.ts
```ts
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Minio from 'minio';
import type { FilesOptions, UploadResultType } from './types';

export class Files {
  private minioClient: Minio.Client | null;
  private bucketName: string;
  private folder: string;

  constructor(options?: FilesOptions) {
    const { folder, minio } = options || {};
    const {
      FILES_FOLDER,
      MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY,
      MINIO_BUCKET_NAME,
      MINIO_ENDPOINT = 'localhost',
      MINIO_PORT = '9000',
      MINIO_USE_SSL = 'true',
    } = process.env;

    this.folder = FILES_FOLDER || folder || '';
    this.bucketName = MINIO_BUCKET_NAME || minio?.bucketName || '';

    this.minioClient =
      this.bucketName && MINIO_ACCESS_KEY && MINIO_SECRET_KEY
        ? new Minio.Client({
            endPoint: minio?.endPoint || MINIO_ENDPOINT,
            port: minio?.port || parseInt(MINIO_PORT, 10),
            useSSL:
              minio?.useSSL !== undefined
                ? minio.useSSL
                : MINIO_USE_SSL === 'true',
            accessKey: minio?.accessKey || MINIO_ACCESS_KEY,
            secretKey: minio?.secretKey || MINIO_SECRET_KEY,
          })
        : null;
  }

  async upload(file: File, destDir: string): Promise<UploadResultType> {
    if (this.folder) {
      return this.uploadLocal(file, destDir);
    }

    if (this.minioClient) {
      return this.uploadMinio(file, destDir);
    }

    throw new Error('FILES_NO_STORAGE_CONFIGURED');
  }

  async delete(objectName: string): Promise<void> {
    if (this.folder) {
      const fullPath = path.join(this.folder, objectName);
      await fs.unlink(fullPath);
      return;
    }

    if (this.minioClient) {
      await this.minioClient.removeObject(this.bucketName, objectName);
      return;
    }

    throw new Error('FILES_NO_STORAGE_CONFIGURED');
  }

  async getPresignedUrl(
    objectName: string,
    expiry = 7 * 24 * 60 * 60,
  ): Promise<string> {
    if (!this.minioClient) {
      throw new Error('FILES_NO_MINIO_CONFIGURED');
    }
    return this.minioClient.presignedGetObject(
      this.bucketName,
      objectName,
      expiry,
    );
  }

  // -- private --

  private async uploadLocal(
    file: File,
    destDir: string,
  ): Promise<UploadResultType> {
    const fullDir = path.join(this.folder, destDir);
    await fs.mkdir(fullDir, { recursive: true });

    const destPath = path.join(fullDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destPath, buffer);

    return { path: destPath, name: file.name, size: file.size };
  }

  private async uploadMinio(
    file: File,
    destDir: string,
  ): Promise<UploadResultType> {
    const objectName = path.posix.join(destDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    await this.minioClient!.putObject(
      this.bucketName,
      objectName,
      buffer,
      file.size,
      { 'Content-Type': file.type || 'application/octet-stream' },
    );

    return {
      path: objectName,
      name: file.name,
      size: file.size,
      bucket: this.bucketName,
    };
  }
}
```

### src/index.ts
```ts
export { Routings } from 'the-api-routings';
export { TheAPI } from './TheApi';
export { Db } from './Db';
export { Email } from './Email';
export { Files } from './Files';
export * as middlewares from './middlewares';
export * from './types';
```

### src/middlewares/default.ts
```ts
import jwt from 'jsonwebtoken';
import { Routings } from 'the-api-routings';
import { randomUUID } from 'crypto';
import type { Next } from 'hono';
import type { AppContext, RoutesErrorType } from '../types';

const { JWT_SECRET } = process.env;
const secret = JWT_SECRET || randomUUID();

const beginMiddleware = async (c: AppContext, next: Next) => {
  const dateBegin = new Date();

  // -- base services (may be overridden by errors middleware) --
  c.set('log', console.log);
  c.set('error', (err: Error | { message: string }) => {
    const m = 'message' in err ? err.message : String(err);
    const match = m.match(/^(\w+):?\s?(.*?)$/);
    const name = match?.[1] ?? m;
    const additional = match?.[2] ?? '';

    const getErr = c.get('getErrorByMessage');
    const errObj: RoutesErrorType | undefined = getErr?.(name);

    c.set('result', { error: true, ...errObj, name, additional });
    if (errObj?.status) c.status(errObj.status as any);
  });

  // -- JWT --
  const token = c.req.raw.headers
    .get('authorization')
    ?.replace(/^bearer\s+/i, '');

  if (token) {
    try {
      c.set('user', jwt.verify(token, secret) as Record<string, unknown>);
    } catch {
      c.var.error(new Error('INVALID_TOKEN'));
      // return immediately - don't process the request
      return formatResponse(c, dateBegin);
    }
  }

  // -- downstream --
  if (!c.var.result) {
    try {
      await next();
    } catch (err) {
      c.var.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // -- 404 --
  if (!c.var.result) {
    c.var.error(new Error('NOT_FOUND'));
  }

  return formatResponse(c, dateBegin);
};

function formatResponse(c: AppContext, dateBegin: Date) {
  const { result, relations, meta, logId } = c.var;
  const error =
    typeof result === 'object' &&
    result !== null &&
    'error' in (result as Record<string, unknown>)
      ? (result as Record<string, unknown>).error
      : false;
  const date = new Date();

  return c.json({
    result,
    relations,
    meta,
    error,
    requestTime: +date - +dateBegin,
    serverTime: date.toISOString(),
    logId,
  });
}

const beginRoute = new Routings();
beginRoute.use('*', beginMiddleware);
beginRoute.errors({
  DEFAULT: {
    code: 11,
    status: 500,
    description: 'An unexpected error occurred',
  },
  ACCESS_DENIED: {
    code: 15,
    status: 403,
    description: 'Insufficient permissions',
  },
  NOT_FOUND: {
    code: 21,
    status: 404,
    description: 'Not found',
  },
  INVALID_TOKEN: {
    code: 25,
    status: 401,
    description: 'Invalid token. Try to renew it.',
  },
  ERROR_QUERY_VALUE: {
    code: 41,
    status: 409,
    description: 'Wrong value in query',
  },
});

// Sentinel: ensures the middleware chain has an endpoint
const endRoute = new Routings();
endRoute.use('*', async () => {});

export { beginRoute, endRoute };
```

### src/middlewares/email.ts
```ts
import { Routings } from 'the-api-routings';
import { Email } from '../Email';
import type { Next } from 'hono';
import type { AppContext, EmailParamsType } from '../types';

const emailMiddleware = async (c: AppContext, n: Next) => {
  const email = new Email();

  c.set(
    'email',
    async ({ to, template, data, ...emailParams }: EmailParamsType) => {
      const tpl = c.var.getTemplateByName(template ?? '');

      let { subject = '', text = '', html = '' } = { ...tpl, ...emailParams };

      if (!subject || (!text && !html)) {
        throw new Error('EMAIL_REQUIRES_FIELDS');
      }

      if (!html) html = text;

      if (data) {
        subject = email.compile(subject, data);
        text = email.compile(text, data);
        html = email.compile(html, data);
      }

      await email.send({ to, subject, text, html });
    },
  );

  await n();
};

const emailRoute = new Routings();
emailRoute.use('*', emailMiddleware);
emailRoute.errors({
  EMAIL_REQUIRES_FIELDS: {
    code: 125,
    status: 400,
    description:
      'Email requires both a subject and either text or HTML content',
  },
});

export { emailRoute as email };
```

### src/middlewares/errors/errorList.ts
```ts
module.exports = {

  DEFAULT_ERROR: {
    code: 10,
    status: 500,
    name: 'Something goes wrong',
    description: 'This is default error. We already know about it and make etherything posible to resolve it.',
  },

  API_METHOD_NOT_FOUND: {
    code: 100,
    status: 404,
    name: 'API method not found',
    description: 'This method is not in API. For available methods use GET /info',
  },

  NOT_FOUND: {
    code: 101,
    status: 404,
    name: 'Not found',
    description: 'API returns empty result',
  },

  NOT_IN_WHITE_LIST: {
    code: 121,
    status: 403,
    name: 'Limit is exceeded (token is not in whitelist)',
    description: 'Your limit was exceeded and user token was removed from whitelist. Please ask admins to incrase limits',
  },

  LIMIT_EXCEEDED: {
    code: 122,
    status: 403,
    name: 'Limit is exceeded',
    description: 'Your limit is exceeded. Please ask admins to incrase limits',
  },

  INTEGER_REQUIRED: {
    code: 131,
    status: 400,
    name: 'Integer required',
    description: 'Variable you have sent is not an integer type',
  },
};
```

### src/middlewares/errors/index.ts
```ts
import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext, RoutesErrorType } from '../../types';

const errorMiddleware = async (c: AppContext, n: Next) => {
  c.set('error', (err: Error | { message: string }) => {
    const m = 'message' in err ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const match = m.match(/^(\w+):?\s?(.*?)$/);

    let name = match?.[1] ?? m;
    let additional = match?.[2] ?? '';

    const getErr = c.get('getErrorByMessage');
    let errorObj: RoutesErrorType | undefined = getErr?.(name);

    if (!errorObj) {
      errorObj = getErr?.('DEFAULT');
      name = m;
      additional = '';
    }

    c.set('result', { ...errorObj, name, additional, stack, error: true });
    c.status((errorObj?.status || 500) as any);
  });

  await n();
};

const errors = new Routings();
errors.use('*', errorMiddleware);

export { errors };
```

### src/middlewares/files.ts
```ts
import { Routings } from 'the-api-routings';
import { Files } from '../Files';
import type { Next } from 'hono';
import type { AppContext } from '../types';

let filesInstance: Files | null = null;

const filesMiddleware = async (c: AppContext, next: Next) => {
  if (!filesInstance) filesInstance = new Files();
  c.set('files', filesInstance);
  await next();
};

const filesRoute = new Routings();
filesRoute.use('*', filesMiddleware);
filesRoute.errors({
  FILES_NO_STORAGE_CONFIGURED: {
    code: 131,
    status: 500,
    description: 'No file storage configured (set FILES_FOLDER or MINIO_*)',
  },
  FILES_NO_MINIO_CONFIGURED: {
    code: 132,
    status: 500,
    description: 'MinIO is not configured for this operation',
  },
});

export { filesRoute as files };
```

### src/middlewares/index.ts
```ts
export { logs } from './logs';
export { info } from './info';
export { status } from './status';
export { errors } from './errors';
export { email } from './email';
export { files } from './files';
```

### src/middlewares/info.ts
```ts
import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext } from '../types';

const file = Bun.file('./package.json');
const { name, version } = await file.json();

const startTime = new Date();
let totalRequests = 0;

const countMiddleware = async (_c: AppContext, n: Next) => {
  totalRequests++;
  await n();
};

const infoMiddleware = async (c: AppContext) => {
  const uptime = Math.floor((+new Date() - +startTime) / 1000);

  c.set('result', { startTime, uptime, totalRequests, name, version });
};

const info = new Routings();
info.use('*', countMiddleware);
info.get('/info', infoMiddleware);

export { info };
```

### src/middlewares/logs.ts
```ts
import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext } from '../types';

const HIDDEN_FIELDS = ['password', 'token', 'refresh', 'authorization'];

const hideObjectValues = (obj: unknown): void => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of HIDDEN_FIELDS) {
    if (key in (obj as Record<string, unknown>)) {
      (obj as Record<string, unknown>)[key] = '<hidden>';
    }
  }
};

const createLogger =
  ({
    id,
    startTime,
    method,
    path,
  }: {
    id: string;
    startTime: Date;
    method: string;
    path: string;
  }) =>
  (...toLog: unknown[]) => {
    const date = new Date();
    const ms = +date - +startTime;
    for (const line of toLog) {
      const isPlain = line instanceof Error || typeof line !== 'object';
      const data = isPlain ? line : JSON.stringify(line);
      console.log(
        `[${date.toISOString()}] [${id}] [${method}] [${path}] [${ms}] ${data}`,
      );
    }
  };

const logMiddleware = async (c: AppContext, n: Next) => {
  const startTime = new Date();
  const { method, headers } = c.req.raw;
  const id = Math.random().toString(36).substring(2, 10);
  c.set('logId', id);

  const { path } = c.req;
  c.set('log', createLogger({ id, startTime, method, path }));

  const ip = c.env?.ip?.address;
  const query = c.req.query();
  const body =
    headers.get('content-type') === 'application/json'
      ? await c.req.json()
      : await c.req.text();

  hideObjectValues(query);
  hideObjectValues(body);

  c.var.log('[begin]', { headers, query, body, ip, method, path });

  await n();

  const result = c.var.result
    ? { ...(c.var.result as Record<string, unknown>) }
    : '';
  hideObjectValues(result);

  const responseSizeOnly =
    `${process.env.LOGS_SHOW_RESPONSE_SIZE_ONLY}` === 'true';
  const response = responseSizeOnly
    ? `${JSON.stringify(result).length}b`
    : result;

  c.var.log(response, '[end]');
};

const logs = new Routings();
logs.use('*', logMiddleware);

export { logs };
```

### src/middlewares/relations.ts
```ts
import flattening from 'flattening';
import { Routings, CrudBuilder } from 'the-api-routings';
import type { CrudBuilderOptionsType, stringRecordType } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext } from '../types';

const relationsMiddleware = async (c: AppContext, next: Next) => {
  await next();

  const result = c.var.result;
  const relationsData = c.var.relationsData as
    | Record<string, CrudBuilderOptionsType>
    | undefined;

  if (!relationsData || !result) return;

  const relations: Record<string, Record<string, unknown>> = {};

  const findRelations = async ([key, definition]: [
    string,
    CrudBuilderOptionsType,
  ]) => {
    const crud = new CrudBuilder(definition);

    const flatData: stringRecordType = flattening({ result, relations });
    const searchKey = new RegExp(`\\b${key}(\\.\\d+)?$`);
    const matchPath = ([path, val]: [string, string]) =>
      path.match(searchKey) && val;

    const ids = [
      ...new Set(
        Object.entries(flatData).map(matchPath).filter(Boolean),
      ),
    ] as string[];

    if (!ids.length) return;

    const idName = definition.relationIdName || 'id';
    const { result: data } = await crud.getRequestResult(c, {
      [idName]: ids,
    });

    if (!relations[key]) relations[key] = {};
    for (const d of data) {
      const idKey = d[idName];
      relations[key][idKey] = d;
    }
  };

  await Promise.all(
    Object.entries(relationsData).map(findRelations),
  );

  c.set('relations', relations);
};

const relationsRoute = new Routings();
relationsRoute.use('*', relationsMiddleware);

export { relationsRoute };
```

### src/middlewares/status.ts
```ts
import { Routings } from 'the-api-routings';
import type { AppContext } from '../types';

const status = new Routings();

status.get('/status', async (c: AppContext) => c.set('result', { ok: 1 }));

export { status };
```

### src/TheApi.ts
```ts
import { Hono } from 'hono';
import { RegExpRouter } from 'hono/router/reg-exp-router';
import { resolve } from 'path';
import { Routings } from 'the-api-routings';
import { Db } from './Db';
import { beginRoute, endRoute } from './middlewares/default';
import { relationsRoute } from './middlewares/relations';
import type { Next, MiddlewareHandler } from 'hono';
import type { Server } from 'bun';
import type { Roles } from 'the-api-roles';
import type { Routings as RoutingsType } from 'the-api-routings';
import type {
  AppEnv,
  AppContext,
  TheApiOptionsType,
  EmailTemplatesType,
  RoutesErrorsType,
  RoutesErrorType,
} from './types';

const {
  PORT = '7788',
  DB_HOST: dbHost,
  DB_WRITE_HOST: dbHostWrite,
} = process.env;

export class TheAPI {
  app: Hono<AppEnv>;
  db: Db | null = null;
  roles?: Roles;
  private errors: RoutesErrorsType = {};
  private routings: RoutingsType[];
  private port: number;
  private migrationDirs: string[] = [
    resolve(`${import.meta.dir}/../src/migrations`),
  ];
  emailTemplates: Record<string, EmailTemplatesType> = {};

  constructor(options?: TheApiOptionsType) {
    const { routings, roles, emailTemplates, port, migrationDirs } =
      options || {};

    this.app = new Hono<AppEnv>({ router: new RegExpRouter() });
    this.roles = roles;
    if (emailTemplates) this.emailTemplates = emailTemplates;
    this.routings = routings || [];
    this.port = port || +PORT;
    if (migrationDirs) this.migrationDirs = migrationDirs;
  }

  async init(): Promise<void> {
    this.collectErrorsAndTemplates();
    this.registerGlobalMiddleware();

    if (dbHost || dbHostWrite) {
      for (const { migrationDirs } of this.routings) {
        if (Array.isArray(migrationDirs)) {
          this.migrationDirs = this.migrationDirs.concat(migrationDirs);
        }
      }
      this.db = new Db({ migrationDirs: this.migrationDirs });
      await this.db.waitDb();
      this.registerDbMiddleware(this.db);
    }

    this.registerRoutes();
  }

  async up() {
    await this.init();
    return {
      fetch: (req: Request, server: Server<any>) =>
        this.app.fetch(req, { ip: server.requestIP(req) }),
      port: this.port,
    };
  }

  addRoutings(routings: RoutingsType | RoutingsType[]): void {
    this.routings = this.routings.concat(routings);
  }

  // -- private --

  private collectErrorsAndTemplates(): void {
    const all = [
      beginRoute,
      relationsRoute,
      ...this.routings,
      endRoute,
    ];

    for (const { routesErrors, routesEmailTemplates } of all) {
      this.errors = { ...this.errors, ...routesErrors };
      this.emailTemplates = {
        ...this.emailTemplates,
        ...routesEmailTemplates,
      };
    }
  }

  private registerGlobalMiddleware(): void {
    // Safety net for uncaught errors
    this.app.onError((err, c: AppContext) => {
      console.error('Unhandled error:', err);
      const error = err instanceof Error ? err : new Error(String(err));

      try {
        const errorHandler = c.var?.error || c.get('error');
        if (typeof errorHandler === 'function') {
          errorHandler(error);
        } else {
          const message = error.message;
          const match = message.match(/^(\w+):?\s?(.*?)$/);
          let name = match?.[1] ?? message;
          let additional = match?.[2] ?? '';

          const getErr = c.var?.getErrorByMessage || c.get('getErrorByMessage');
          let errObj =
            typeof getErr === 'function' ? getErr(name) : undefined;

          if (!errObj && typeof getErr === 'function') {
            errObj = getErr('DEFAULT');
            name = message;
            additional = '';
          }

          c.set('result', { ...errObj, name, additional, error: true });
          if (errObj?.status) c.status(errObj.status as any);
        }
      } catch {
        c.set('result', {
          error: true,
          message: error.message,
          status: 500,
          code: 0,
        });
        c.status(500);
      }

      const result = c.var?.result ?? {
        error: true,
        message: error.message,
        status: 500,
        code: 0,
      };
      const status =
        typeof result === 'object' &&
        result !== null &&
        'status' in (result as Record<string, unknown>) &&
        typeof (result as Record<string, unknown>).status === 'number'
          ? ((result as Record<string, unknown>).status as number)
          : c.res.status || 500;
      const hasErrorField =
        typeof result === 'object' &&
        result !== null &&
        'error' in (result as Record<string, unknown>);

      return c.json(
        {
          result,
          relations: c.var?.relations,
          meta: c.var?.meta,
          error: hasErrorField
            ? (result as Record<string, unknown>).error
            : true,
          serverTime: new Date().toISOString(),
          logId: c.var?.logId,
        },
        status as any,
      );
    });

    // Inject error lookup + template lookup + roles
    this.app.all('*', async (c: AppContext, n: Next) => {
      c.set(
        'getErrorByMessage',
        (message: string): RoutesErrorType | undefined =>
          this.errors[message],
      );
      c.set(
        'getTemplateByName',
        (name: string): EmailTemplatesType =>
          this.emailTemplates[name] || {},
      );
      if (this.roles) c.set('roles', this.roles);

      await n();
    });
  }

  private registerDbMiddleware(db: Db): void {
    this.app.all('*', async (c: AppContext, n: Next) => {
      c.set('db', db.db);
      c.set('dbWrite', db.dbWrite);
      c.set('dbTables', db.dbTables);
      await n();
    });
  }

  private registerRoutes(): void {
    const rolesRoute = new Routings();
    if (this.roles) rolesRoute.use('*', this.roles.rolesMiddleware);
    const app = this.app as any;

    const routesArr = [
      beginRoute,
      rolesRoute,
      relationsRoute,
      ...this.routings,
      endRoute,
    ];

    for (const { routes, routesPermissions } of routesArr) {
      this.roles?.addRoutePermissions(routesPermissions);

      for (const route of routes) {
        if (route.method) {
          switch (route.method) {
            case 'GET':
              app.get(route.path, ...route.handlers);
              break;
            case 'POST':
              app.post(route.path, ...route.handlers);
              break;
            case 'PATCH':
              app.patch(route.path, ...route.handlers);
              break;
            case 'PUT':
              app.put(route.path, ...route.handlers);
              break;
            case 'DELETE':
              app.delete(route.path, ...route.handlers);
              break;
            case 'OPTIONS':
              app.options(route.path, ...route.handlers);
              break;
            default:
              app.all(
                route.path,
                ...(route.handlers as unknown as MiddlewareHandler[]),
              );
          }
        } else {
          app.all(
            route.path,
            ...(route.handlers as unknown as MiddlewareHandler[]),
          );
        }
      }
    }
  }
}
```

### src/types.ts
```ts
import type { Context, MiddlewareHandler, Handler } from 'hono';
import type { SocketAddress } from 'bun';
import type { Knex } from 'knex';
import type { H } from 'hono/types';
import type { Routings, CrudBuilderOptionsType as ExternalCrudOpts } from 'the-api-routings';
import type { Roles } from 'the-api-roles';
import type { Files } from './Files';

export type { MiddlewareHandler, Handler };

// ------------------------------------------
// HTTP
// ------------------------------------------

export type MethodType = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';

export type MethodPathType = {
  method?: MethodType;
  path: string;
};

export type RoutesType = MethodPathType & {
  handlers: (Handler | MiddlewareHandler)[];
};

export type PushToRoutesParamsType = MethodPathType & {
  fnArr: H<any, any, {}, any>[];
};

// ------------------------------------------
// Errors
// ------------------------------------------

export type RoutesErrorType = {
  code: number;
  status: number;
  description?: string;
};

export type RoutesErrorsType = Record<string, RoutesErrorType>;

// ------------------------------------------
// Email
// ------------------------------------------

export type EmailTemplatesType = {
  subject?: string;
  text?: string;
  html?: string;
};

export type EmailParamsType = EmailTemplatesType & {
  to: string;
  template?: string;
  data?: Record<string, unknown>;
};

export type EmailConfig = {
  host?: string;
  port?: number | string;
  secure?: boolean;
  auth?: { user?: string; pass?: string };
  from?: string;
  tls?: { rejectUnauthorized?: boolean };
};

// ------------------------------------------
// Files
// ------------------------------------------

export type UploadResultType = {
  path: string;
  name: string;
  size: number;
  bucket?: string;
};

export type FilesOptions = {
  folder?: string;
  minio?: {
    bucketName?: string;
    endPoint?: string;
    port?: number;
    useSSL?: boolean;
    accessKey?: string;
    secretKey?: string;
  };
};

// ------------------------------------------
// Database
// ------------------------------------------

export type DbColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  table_schema: string;
  table_name: string;
  references?: {
    table_schema: string;
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_schema: string;
    foreign_table_name: string;
    foreign_column_name: string;
  };
  [key: string]: unknown;
};

export type DbTablesType = Record<string, Record<string, DbColumnInfo>>;

export type DbOptionsType = {
  migrationDirs?: string[];
};

// ------------------------------------------
// Hono App - Environment
// ------------------------------------------

export type AppBindings = {
  ip: SocketAddress | null;
};

export type AppVariables = {
  // -- core (set by default middleware) --
  log: (...args: unknown[]) => void;
  error: (err: Error | { message: string }) => void;
  getErrorByMessage: (message: string) => RoutesErrorType | undefined;
  getTemplateByName: (name: string) => EmailTemplatesType;

  // -- request state --
  result: unknown;
  meta: Record<string, unknown>;
  relations: Record<string, unknown>;
  relationsData: Record<string, unknown>;
  logId: string;
  user: Record<string, unknown>;

  // -- database (set when DB configured) --
  db: Knex;
  dbWrite: Knex;
  dbTables: DbTablesType;

  // -- optional services (depend on middleware) --
  files: Files;
  roles: Roles;
  email: (params: EmailParamsType) => Promise<void>;
};

export type AppEnv = {
  Bindings: AppBindings;
  Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;

// ------------------------------------------
// Config
// ------------------------------------------

export type TheApiOptionsType = {
  routings: Routings[];
  roles?: Roles;
  emailTemplates?: Record<string, EmailTemplatesType>;
  port?: number;
  migrationDirs?: string[];
};

export type RoutingsOptionsType = {
  migrationDirs?: string[];
};

// ------------------------------------------
// CRUD builder (re-export convenience)
// ------------------------------------------

export type stringRecordType = Record<string, string>;
export type fieldType = string | number | boolean;
export type fieldRecordType = Record<string, fieldType>;
export type whereParamsType = stringRecordType & { isDeleted?: boolean };

export type CrudBuilderJoinType = {
  table: string;
  schema?: string;
  alias?: string;
  as?: string;
  where?: string;
  whereBindings?: stringRecordType;
  defaultValue?: fieldType;
  fields?: string[];
  field?: string;
  orderBy?: string;
  limit?: number;
  leftJoin?: string | string[];
  byIndex?: number;
  permission?: string;
};

export type CrudBuilderPermissionsType = {
  methods?: (MethodType | '*')[];
  owner?: string[];
  fields?: {
    viewable?: Record<string, string[]>;
    editable?: Record<string, string[]>;
  };
};

export type CrudBuilderOptionsType = {
  c?: Context;
  table: string;
  prefix?: string;
  schema?: string;
  aliases?: stringRecordType;
  join?: CrudBuilderJoinType[];
  joinOnDemand?: CrudBuilderJoinType[];
  leftJoin?: string[];
  leftJoinDistinct?: string[];
  lang?: string;
  translate?: string[];
  searchFields?: string[];
  requiredFields?: string[];
  hiddenFields?: string[];
  readOnlyFields?: string[];
  showFieldsByPermission?: Record<string, string[]>;
  permissions?: CrudBuilderPermissionsType;
  defaultWhere?: fieldRecordType;
  defaultWhereRaw?: string;
  defaultSort?: string;
  sortRaw?: string;
  fieldsRaw?: unknown;
  includeDeleted?: boolean;
  deletedReplacements?: fieldRecordType;
  relations?: Record<string, CrudBuilderOptionsType>;
  relationIdName?: string;
  tokenRequired?: unknown;
  ownerRequired?: unknown;
  rootRequired?: unknown;
  access?: unknown;
  accessByStatuses?: unknown;
  dbTables?: DbTablesType;
  cache?: unknown;
  userIdFieldName?: string;
  additionalFields?: unknown;
  apiClientMethodNames?: unknown;
};

export type metaType = {
  total: number;
  limit?: number;
  skip?: number;
  page?: number;
  nextPage?: number;
  pages?: number;
  after?: string;
  nextAfter?: string;
  isFirstPage?: boolean;
  isLastPage?: boolean;
};

export type getResultType = {
  result: unknown[];
  meta: metaType;
  relations?: Record<string, unknown[]>;
  error?: boolean;
};
```

### test/core.dist.spec.ts
```ts
import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { Routings, TheAPI } from '../dist';
import type { Next } from 'hono';
import type { AppContext } from '../src';

const router = new Routings();

router.get('/', async (c: AppContext, n: Next) => {
  await n();
  c.set('result', {...c.var.result, e11: 'Hi11'});
});

router.get('/', async (c: AppContext) => {
  c.set('result', {e22: 'Hi22'});
});

router.post('/post/:id', async (c: AppContext) => {
  const body = await c.req.json();
  c.set('result', {...c.req.param(), ...body});
});

router.get('/search/:search', async (c: AppContext) => {
  c.set('result', c.req.param());
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('Core Dist', () => {
  test('init', async () => {
    await theAPI.init();
  });
  test('GET /', async () => {
    const { result } = await client.get('/');
    expect(result).toEqual({ e11:'Hi11', e22:'Hi22' });
  });

  test('POST /post/12', async () => {
    const { result } = await client.post('/post/12', { test: true, data: { test: false, arr: [1, 'a'] } });
    expect(result).toEqual({ id: '12', test: true, data: { test: false, arr: [1, 'a'] } });
  });

  test('GET /search/4', async () => {
    const { result } = await client.get('/search/world4');
    expect(result).toEqual({ search: 'world4' });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/core.spec.ts
```ts
import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { Routings, TheAPI } from '../src';
import type { Context, Next } from 'hono';

const router = new Routings();

router.get('/', async (c: Context, n: Next) => {
  await n();
  c.set('result', {...c.var.result, e11: 'Hi11'});
});

router.get('/', async (c: Context) => {
  c.set('result', {e22: 'Hi22'});
});

router.post('/post/:id', async (c: Context) => {
  const body = await c.req.json();
  c.set('result', {...c.req.param(), ...body});
});

router.get('/search/:search', async (c: Context) => {
  c.set('result', c.req.param());
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('Core', () => {
  test('init', async () => {
    await theAPI.init();
  });
  test('GET /', async () => {
    const { result } = await client.get('/');
    expect(result).toEqual({ e11:'Hi11', e22:'Hi22' });
  });

  test('POST /post/12', async () => {
    const { result } = await client.post('/post/12', { test: true, data: { test: false, arr: [1, 'a'] } });
    expect(result).toEqual({ id: '12', test: true, data: { test: false, arr: [1, 'a'] } });
  });

  test('GET /search/4', async () => {
    const { result } = await client.get('/search/world4');
    expect(result).toEqual({ search: 'world4' });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/after.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testNews' });

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET after', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('after by timeCreated, limit 1', () => {
    let nextAfter: string;
    test('GET /testNews?_limit=1&_sort=timeCreated', async () => {
      const { meta, result } = await client.get('/testNews?_limit=1&_sort=timeCreated');
      ({ nextAfter } = meta);
      expect(meta).toEqual({
        nextAfter,
        total: 3,
        limit: 1,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 3,
        isFirstPage: true,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(1);
    });

    test('GET /testNews?_limit=1&_sort=timeCreated&_after=nextAfter', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=1&_sort=timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(2);
    });

    test('GET /testNews?_limit=1&_sort=timeCreated&_after=nextAfter', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=1&_sort=timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(3);
    });

    test('GET /testNews?_limit=1&_sort=timeCreated&_after=nextAfter', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=1&_sort=timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result).toEqual([]);
    });
  });

  describe('after by timeCreated desc, limit 2', () => {
    let nextAfter: string;
    test('GET /testNews?_limit=2&_sort=-timeCreated', async () => {
      const { meta, result } = await client.get('/testNews?_limit=2&_sort=-timeCreated');
      ({ nextAfter } = meta);
      expect(meta).toEqual({
        nextAfter,
        total: 3,
        limit: 2,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 2,
        isFirstPage: true,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(3);
      expect(result[1].id).toEqual(2);
    });

    test('GET /testNews?_limit=2&_sort=-timeCreated&_after=nextAfter1', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result[0].id).toEqual(1);
    });

    test('GET /testNews?_limit=2&_sort=-timeCreated&_after=nextAfter2', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-timeCreated&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result).toEqual([]);
    });
  });

  describe('after by timeCreated desc, limit 2', () => {
    let nextAfter: string;
    test('GET /testNews?_limit=2&_sort=-id', async () => {
      const { meta, result } = await client.get('/testNews?_limit=2&_sort=-id');
      ({ nextAfter } = meta);
      expect(meta).toEqual({
        nextAfter,
        total: 3,
        limit: 2,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 2,
        isFirstPage: true,
        isLastPage: false,
      });
      expect(result[0].id).toEqual(3);
      expect(result[1].id).toEqual(2);
    });

    test('GET /testNews?_limit=2&_sort=-id&_after=nextAfter1', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-id&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result[0].id).toEqual(1);
    });

    test('GET /testNews?_limit=2&_sort=-id&_after=nextAfter2', async () => {
      const { meta, result } = await client.get(`/testNews?_limit=2&_sort=-id&_after=${nextAfter}`);
      const after = decodeURIComponent(nextAfter);
      ({ nextAfter } = meta);
      expect(after).not.toEqual(nextAfter);
      expect(meta).toEqual({
        total: 3,
        after,
        nextAfter,
        isFirstPage: false,
        isLastPage: true,
      });
      expect(result).toEqual([]);
    });
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
```

### test/crud/deleted.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testTypes',
});
router.crud({
  table: 'testTypes',
  prefix: 'testTypesWithDeleted',
  includeDeleted: true,
  deletedReplacements: {
    name: 'Deleted News',
  },
});

router.crud({
  table: 'testNews',
});
router.crud({
  table: 'testNews',
  prefix: 'testNewsWithDeleted',
  includeDeleted: true,
  deletedReplacements: {
    name: 'Deleted News',
  },
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET deleted', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()', isDeleted: true });
      await client.post('/testNews', { name: 'test112' });
    });
  });

  describe('check deleted was hidden', () => {
    test('GET /testTypes', async () => {
      const { meta } = await client.get('/testTypes?_sort=id');
      expect(meta.total).toEqual(2);
    });

    test('DELETE /testTypes/1', async () => {
      const { result } = await client.delete('/testTypes/1');
      expect(result.ok).toEqual(true);
    });

    test('GET /testTypes', async () => {
      const { meta } = await client.get('/testTypes?_sort=id');
      expect(meta.total).toEqual(1);
    });

    test('GET /testTypes/1', async () => {
      const { result } = await client.get('/testTypes/1');
      expect(result.error).toEqual(true);
    });
  });

  describe('check with deleted', () => {
    test('GET /testTypesWithDeleted', async () => {
      const { result, meta } = await client.get('/testTypesWithDeleted?_sort=id');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('type2');
    });

    test('GET /testTypesWithDeleted/1', async () => {
      const { result } = await client.get('/testTypesWithDeleted/1');
      expect(result.error).toEqual(true);
    });
  });

  describe('isDeleted: check deleted was hidden', () => {
    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(2);
    });

    test('DELETE /testNews/1', async () => {
      const { result } = await client.delete('/testNews/1');
      expect(result.ok).toEqual(true);
    });

    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(1);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.error).toEqual(true);
    });
  });

  describe('isDeleted: check with deleted', () => {
    test('GET /testNewsWithDeleted', async () => {
      const { result } = await client.get('/testNewsWithDeleted?_sort=id');
      expect(result[0].isDeleted).toEqual(true);
      expect(result[0].name).toEqual('Deleted News');
      expect(result[1].isDeleted).toEqual(false);
    });

    test('GET /testNewsWithDeleted/1', async () => {
      const { result } = await client.get('/testNewsWithDeleted/1');
      expect(result.isDeleted).toEqual(true);
      expect(result.name).toEqual('Deleted News');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/fieldsDeleted.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',
  aliases: {
    name: 'newsName',
  },
  hiddenFields: [
    'timeCreated',
    'views',
  ],
  includeDeleted: true,
  deletedReplacements: {
    name: 'Deleted News',
  },
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET fields', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()', isDeleted: true });
      await client.post('/testNews', { name: 'test112' });
    });
  });

  describe('check hidden fields', () => {
    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id');
      expect(result[0].timeCreated).toEqual(undefined);
      expect(result[0].views).toEqual(undefined);
      expect(result[0].timePublished).toBeTypeOf('string');
      expect(result[1].timeCreated).toEqual(undefined);
      expect(result[1].views).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.timeCreated).toEqual(undefined);
      expect(result.views).toEqual(undefined);
      expect(result.timePublished).toBeTypeOf('string');
    });
  });

  describe('check name on deleted', () => {
    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id');
      expect(result[0].newsName).toEqual(result[0].name);
      expect(result[1].newsName).toEqual(result[1].name);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.newsName).toEqual(result.name);
    });
  });

  describe('check deleted', () => {
    test('DELETE /testNews/1', async () => {
      const { result } = await client.delete('/testNews/1');
      expect(result.ok).toEqual(true);
    });

    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id');
      expect(result[0].newsName).not.toEqual(result[0].name);
      expect(result[0].isDeleted).toEqual(true);
      expect(result[0].name).toEqual('Deleted News');
      expect(result[0].newsName).toEqual('test111');
      expect(result[1].newsName).toEqual(result[1].name);
      expect(result[1].isDeleted).toEqual(false);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/1');
      expect(result.newsName).not.toEqual(result.name);
      expect(result.isDeleted).toEqual(true);
      expect(result.name).toEqual('Deleted News');
      expect(result.newsName).toEqual('test111');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/fieldsHiddenReadonly.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from '../../src';
import { getTestClient } from '../lib';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',

  hiddenFields: ['timeUpdated', 'typeId'], // they're hidden everywhere and 're also readonly
  readOnlyFields: ['timeCreated', 'views'],
});

const theAPI = new TheAPI({ roles, routings: [router] });
const client = await getTestClient(theAPI);

describe('Hidden and Readonly Fields', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });

    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' });
      await client.post('/testNews', { name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
    });
  });

  describe('hidden', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(2);
      expect(result[0].timeUpdated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.typeId).toEqual(undefined);
    });
  });

  describe('readonly', () => {
    test('GET /testNews/2', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.views).toEqual(0);
      expect(result.timeCreated > '2024-06-02').toEqual(true);
    });

    test('PATCH /testNews/2', async () => {
      const { result } = await client.patch('/testNews/2', { views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
      expect(result.views).toEqual(0);
      expect(result.timeCreated > '2024-06-02').toEqual(true);
    });

    test('GET /testNews/2', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.views).toEqual(0);
      expect(result.timeCreated > '2024-06-02').toEqual(true);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/fields.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testNews' });
router.crud({
  table: 'testNews',
  prefix: 'testAll',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    },
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
    },
  ],
});
router.crud({
  table: 'testNews',
  prefix: 'testAllOnDemand',
  joinOnDemand: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    },
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
    },
  ],
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET fields', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('GET all', () => {
    test('GET /testNews?_fields=name', async () => {
      const { result } = await client.get('/testNews?_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]);
    });

    test('GET /testNews?_fields=id,typeId', async () => {
      const { result } = await client.get('/testNews?_fields=id,typeId');
      expect(result).toEqual([
        {
          id: 1,
          typeId: 1,
        }, {
          id: 2,
          typeId: 1,
        }, {
          id: 3,
          typeId: 2,
        }
      ]);
    });
  });

  describe('GET by id', () => {
    test('GET /testNews/1?_fields=name', async () => {
      const { result } = await client.get('/testNews/1?_fields=name');
      expect(result).toEqual({ name: 'test111'});
    });

    test('GET /testNews/1?_fields=id,typeId', async () => {
      const { result } = await client.get('/testNews/1?_fields=id,typeId');
      expect(result).toEqual({
        id: 1,
        typeId: 1,
      });
    });
  });

  describe('joined', () => {
    test('GET /testAll?_fields=name', async () => {
      const { result } = await client.get('/testAll?_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]);
    });

    test('GET /testAll?_fields=name,typeName', async () => {
      const { result } = await client.get('/testAll?_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAll?_fields=name,testTypes', async () => {
      const { result } = await client.get('/testAll?_fields=name,testTypes');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test112',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test222',
          typeName: 'type2',
          testTypes: [
            {
              id: 2,
              name: 'type2'
            }
          ],
        }
      ]
      );
    });
  });

  describe('joined on demand', () => {
    test('GET /testAllOnDemand?_fields=name', async () => {
      const { result } = await client.get('/testAllOnDemand?_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]);
    });

    test('GET /testAllOnDemand?_join=typeName&_fields=name,typeName', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName&_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=typeName,testTypes&_fields=name', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName,testTypes&_fields=name');
      expect(result).toEqual([
        {
          name: 'test111',
        }, {
          name: 'test112',
        }, {
          name: 'test222',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=typeName,testTypes&_fields=name,typeName', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName,testTypes&_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=testTypes&_fields=name,typeName', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=testTypes&_fields=name,typeName');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
        }, {
          name: 'test112',
          typeName: 'type1',
        }, {
          name: 'test222',
          typeName: 'type2',
        }
      ]
      );
    });

    test('GET /testAllOnDemand?_join=typeName,testTypes&_fields=name,testTypes', async () => {
      const { result } = await client.get('/testAllOnDemand?_join=typeName,testTypes&_fields=name,testTypes');
      expect(result).toEqual([
        {
          name: 'test111',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test112',
          typeName: 'type1',
          testTypes: [
            {
              id: 1,
              name: 'type1'
            }
          ],
        }, {
          name: 'test222',
          typeName: 'type2',
          testTypes: [
            {
              id: 2,
              name: 'type2'
            }
          ],
        }
      ]
      );
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/filter.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testNews' });
router.crud({
  table: 'testNews',
  prefix: 'testAll',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    }
  ]
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET filters', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('simple', () => {
    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews');
      expect(meta.total).toEqual(3);
    });

    test('GET /testNews?name=test112', async () => {
      const { result, meta } = await client.get('/testNews?name=test112');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?name=test112&name=test222', async () => {
      const { meta } = await client.get('/testNews?name=test112&name=test222');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_in_name=encodeURIComponent([\'test112\',\'test222\'])', async () => {
      const data = encodeURIComponent(JSON.stringify(['test112','test222']));
      const { meta } = await client.get(`/testNews?_in_name=${data}`);
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_in_name=[\'test112\',\'test222\']', async () => {
      const { meta } = await client.get(`/testNews?_in_name=["test112","test222"]`);
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_not_in_name=encodeURIComponent([\'test112\',\'test222\'])', async () => {
      const data = encodeURIComponent(JSON.stringify(['test112','test222']));
      const { meta } = await client.get(`/testNews?_not_in_name=${data}`);
      expect(meta.total).toEqual(1);
    });

    test('GET /testNews?_not_in_name=[\'test112\',\'test222\']', async () => {
      const { meta } = await client.get(`/testNews?_not_in_name=["test112","test222"]`);
      expect(meta.total).toEqual(1);
    });

    test('GET /testNews?typeId=1', async () => {
      const { meta } = await client.get('/testNews?typeId=1');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?typeId=1&name=test111', async () => {
      const { result, meta } = await client.get('/testNews?typeId=1&name=test111');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?name~=test%22', async () => {
      const { result, meta } = await client.get('/testNews?name~=test%2522');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?name!=test111', async () => {
      const { meta } = await client.get('/testNews?name!=test111');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?name!=test111&name!=test112', async () => {
      const { result, meta } = await client.get('/testNews?name!=test111&name!=test112');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?typeId=2', async () => {
      const { result, meta } = await client.get('/testNews?typeId=2');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('not so simple', () => {
    test('GET /testNews?_from_typeId=2', async () => {
      const { result, meta } = await client.get('/testNews?_from_typeId=2');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_to_typeId=1', async () => {
      const { meta } = await client.get('/testNews?_to_typeId=1');
      expect(meta.total).toEqual(2);
    });

    test('GET /testNews?_from_name=test1999', async () => {
      const { result, meta } = await client.get('/testNews?_from_name=test1999');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_from_timeCreated=...&_to_timeCreated=...', async () => {
      const from = DateTime.now().minus({ day: 1 }).toFormat('yyyy-MM-dd');
      const to = DateTime.now().plus({ day: 1 }).toFormat('yyyy-MM-dd');
      const { meta } = await client.get(`/testNews?_from_timeCreated=${from}&_to_timeCreated=${to}`);
      expect(meta.total).toEqual(3);
    });

    test('GET /testNews?_not_null_timePublished=true', async () => {
      const { result, meta } = await client.get('/testNews?_not_null_timePublished=true');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_to_timePublished=...', async () => {
      const now = encodeURIComponent(DateTime.now().toISO());
      const { result, meta } = await client.get(`/testNews?_to_timePublished=${now}`);
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_to_timePublished=NOW()', async () => {
      const { result, meta } = await client.get('/testNews?_to_timePublished=NOW()');
      expect(meta.total).toEqual(1);
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_null_timePublished=true', async () => {
      const { meta } = await client.get('/testNews?_null_timePublished=true');
      expect(meta.total).toEqual(2);
    });
  });

  describe('by joined data', () => {
    test('GET /testAll?typeName=type2', async () => {
      const { result } = await client.get('/testAll?typeName=type2');
      expect(result[0].typeName).toEqual('type2');
    });

    test('GET /testAll?typeName=type1&typeName=type2', async () => {
      const { meta } = await client.get('/testAll?typeName=type1&typeName=type2');
      expect(meta.total).toEqual(3);
    });

    test('GET /testAll?typeName=type1&typeName=typex', async () => {
      const { meta } = await client.get('/testAll?typeName=type1&typeName=typex');
      expect(meta.total).toEqual(2);
    });

    test('GET /testAll?typeName=type1&typeName=type2', async () => {
      const { result } = await client.get('/testAll?typeName=type1&name=test112');
      expect(result[0].name).toEqual('test112');
    });
  });

  describe('empty results', () => {
    test('GET /testNews?name=test000', async () => {
      const { meta } = await client.get('/testNews?name=test000');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?typeId=2&name=test111', async () => {
      const { meta } = await client.get('/testNews?typeId=2&name=test111');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_from_name=test999', async () => {
      const { meta } = await client.get('/testNews?_from_name=test999');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_to_name=test11', async () => {
      const { meta } = await client.get('/testNews?_to_name=test11');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_from_timeCreated=...', async () => {
      const to = DateTime.now().plus({ day: 1 }).toFormat('yyyy-MM-dd');
      const { meta } = await client.get(`/testNews?_from_timeCreated=${to}`);
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_to_timeCreated=...', async () => {
      const from = DateTime.now().minus({ day: 1 }).toFormat('yyyy-MM-dd');
      const { meta } = await client.get(`/testNews?_to_timeCreated=${from}`);
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_not_null_timeUpdated=true', async () => {
      const { meta } = await client.get('/testNews?_not_null_timeUpdated=true');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_from_timePublished=NOW()', async () => {
      const { meta } = await client.get('/testNews?_from_timePublished=NOW()');
      expect(meta.total).toEqual(0);
    });

    test('GET /testNews?_in_name=[\'test112\',\'test222\']', async () => {
      const { error } = await client.get(`/testNews?_in_name=['test112','test222']`);
      expect(error).toEqual(true);
    });

    test('GET /testAll?typeName=typex', async () => {
      const { meta } = await client.get('/testAll?typeName=typex');
      expect(meta.total).toEqual(0);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/join.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testTypeAges' });
router.crud({ table: 'testNews' });
router.crud({
  table: 'testNews',
  prefix: 'testJoin',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testAs',
  join: [
    {
      table: 'testNews',
      as: 'testNews2',
      where: '"testNews2".id = "testNews"."id"',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testAlias',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testOnDemand',
  joinOnDemand: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    }
  ]
});
router.get('/testWhereBindings', async (c, n) => {
  c.set('_typeName' as any, 'type1');
  await n();
});
router.get('/testWhereBindings/:id', async (c, n) => {
  c.set('_typeName' as any, 'type2');
  await n();
});
router.crud({
  table: 'testNews',
  prefix: 'testWhereBindings',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId" AND "testTypes".name = :typeName',
      whereBindings: { typeName: 'env._typeName' },
      defaultValue: '[{ "name": "noType" }]',
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testWithLatestNewsInTheSameCategory',
  join: [
    {
      table: 'testNews',
      as: 'latestNewsInCategory',
      alias: 'latestNewsInCategory',
      where: '"latestNewsInCategory"."typeId" = "testNews"."typeId" AND "latestNewsInCategory".id != "testNews".id',
      fields: ['name', 'timeCreated'],
      limit: 1,
      orderBy: '"timeCreated" DESC',
      byIndex: 0,
    }
  ]
});
router.crud({
  table: 'testNews',
  prefix: 'testLeftJoin',
  join: [
    {
      table: 'testTypes',
      alias: 'ages',
      where: '"testTypes".id = "testNews"."typeId"',
      leftJoin: ['testTypeAges', '"testTypeAges"."typeId"', '"testTypes".id'],
      orderBy: '"testTypeAges".id DESC',
      fields: ['name', 'age'],
    }
  ]
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET join', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testTypeAges', { typeId: 1, age: '7-15' });
      await client.post('/testTypeAges', { typeId: 1, age: '16-21' });
      await client.post('/testTypeAges', { typeId: 2, age: '16-21' });
      await client.post('/testTypeAges', { typeId: 2, age: '22-99' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1 });
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('join', () => {
    test('GET /testJoin?_sort=name', async () => {
      const { result } = await client.get('/testJoin?_sort=name');
      expect(result[0].testTypes).toEqual([{ id: 1, name: 'type1' }]);
    });

    test('GET /testJoin?_fields=name,testTypes&_sort=name', async () => {
      const { result } = await client.get('/testJoin?_fields=name,testTypes&_sort=-name');
      expect(result[0].testTypes).toEqual([{ id: 2, name: 'type2' }]);
    });

    test('GET /testJoin/1', async () => {
      const { result } = await client.get('/testJoin/1');
      expect(result.testTypes).toEqual([{ id: 1, name: 'type1' }]);
    });

    test('GET /testJoin/3', async () => {
      const { result } = await client.get('/testJoin/3');
      expect(result.testTypes).toEqual([{ id: 2, name: 'type2' }]);
    });
  });

  describe('as', () => {
    test('GET /testAs?_sort=name', async () => {
      const { result } = await client.get('/testAs?_sort=name');
      expect(result[0].testNews[0].name).toEqual('test111');
    });

    test('GET /testAs?_fields=name,testTypes&_sort=name', async () => {
      const { result } = await client.get('/testAs?_fields=name,testNews&_sort=-name');
      expect(result[0].testNews[0].name).toEqual('test222');
    });

    test('GET /testAs/1', async () => {
      const { result } = await client.get('/testAs/1');
      expect(result.testNews[0].name).toEqual('test111');
    });

    test('GET /testAs/3', async () => {
      const { result } = await client.get('/testAs/3');
      expect(result.testNews[0].name).toEqual('test222');
    });
  });

  describe('alias', () => {
    test('GET /testAlias?_sort=name', async () => {
      const { result } = await client.get('/testAlias?_sort=name');
      expect(result[0].typeName).toEqual('type1');
    });

    test('GET /testAlias?_sort=name', async () => {
      const { result } = await client.get('/testAlias?_fields=name,typeName&_sort=-name');
      expect(result[0].typeName).toEqual('type2');
    });

    test('GET /testAlias/1', async () => {
      const { result } = await client.get('/testAlias/1');
      expect(result.typeName).toEqual('type1');
    });

    test('GET /testAlias/3', async () => {
      const { result } = await client.get('/testAlias/3');
      expect(result.typeName).toEqual('type2');
    });
  });

  describe('on demand', () => {
    test('GET /testOnDemand?_sort=name', async () => {
      const { result } = await client.get('/testOnDemand?_join=testTypes&_fields=name,typeName&_sort=name');
      expect(result[0].typeName).toEqual('type1');
    });

    test('GET /testOnDemand/1', async () => {
      const { result } = await client.get('/testOnDemand/1?_join=testTypes&_fields=name,typeName');
      expect(result.typeName).toEqual('type1');
    });

    test('GET /testOnDemand?_sort=name', async () => {
      const { error } = await client.get('/testOnDemand?_fields=name,typeName&_sort=name');
      expect(error).toEqual(true);
    });
  });

  describe('bindings', () => {
    test('GET /testWhereBindings?_sort=name', async () => {
      const { result } = await client.get('/testWhereBindings?_sort=name');
      expect(result[0].testTypes[0].name).toEqual('type1');
      expect(result[2].testTypes[0].name).toEqual('noType');
    });

    test('GET /testWhereBindings/1', async () => {
      const { result } = await client.get('/testWhereBindings/1');
      expect(result.testTypes[0].name).toEqual('noType');
    });

    test('GET /testWhereBindings/3', async () => {
      const { result } = await client.get('/testWhereBindings/3');
      expect(result.testTypes[0].name).toEqual('type2');
    });
  });

  describe('latest news in the same category', () => {
    test('GET /testWithLatestNewsInTheSameCategory?_sort=name', async () => {
      const { result } = await client.get('/testWithLatestNewsInTheSameCategory?_sort=name');
      expect(result[0].latestNewsInCategory.name).toEqual('test112');
      expect(result[1].latestNewsInCategory.name).toEqual('test111');
      expect(result[2].latestNewsInCategory).toEqual(null);
    });

    test('GET /testWithLatestNewsInTheSameCategory/1', async () => {
      const { result } = await client.get('/testWithLatestNewsInTheSameCategory/1');
      expect(result.latestNewsInCategory.name).toEqual('test112');
    });

    test('GET /testWithLatestNewsInTheSameCategory/3', async () => {
      const { result } = await client.get('/testWithLatestNewsInTheSameCategory/3');
      expect(result.latestNewsInCategory).toEqual(null);
    });
  });

  describe('left join', () => {
    test('GET /testLeftJoin?_sort=name', async () => {
      const { result } = await client.get('/testLeftJoin?_sort=name');
      expect(result[0].ages).toEqual([
        {
          age: "16-21",
          name: "type1",
        }, {
          age: "7-15",
          name: "type1",
        }
      ]);
      expect(result[2].ages).toEqual([
        {
          age: "22-99",
          name: "type2",
        }, {
          age: "16-21",
          name: "type2",
        }
      ]);
    });

    test('GET /testLeftJoin/1', async () => {
      const { result } = await client.get('/testLeftJoin/1');
      expect(result.ages).toEqual([
        {
          age: "16-21",
          name: "type1",
        }, {
          age: "7-15",
          name: "type1",
        }
      ]);
    });

    test('GET /testLeftJoin/3', async () => {
      const { result } = await client.get('/testLeftJoin/3');
      expect(result.ages).toEqual([
        {
          age: "22-99",
          name: "type2",
        }, {
          age: "16-21",
          name: "type2",
        }
      ]);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/pagination.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testNews' });

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET pagination', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('simple', () => {
    test('GET /testNews', async () => {
      const { meta } = await client.get('/testNews');
      expect(meta.total).toEqual(3);
    });

    test('GET /testNews?_limit=1', async () => {
      const { meta } = await client.get('/testNews?_limit=1');
      expect(meta).toEqual({
        total: 3,
        limit: 1,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 3,
        isFirstPage: true,
        isLastPage: false,
      });
    });

    test('GET /testNews?_limit=2&_page=1', async () => {
      const { meta } = await client.get('/testNews?_limit=2&_page=1');
      expect(meta).toEqual({
        total: 3,
        limit: 2,
        skip: 0,
        page: 1,
        nextPage: 2,
        pages: 2,
        isFirstPage: true,
        isLastPage: false,
      });
    });

    test('GET /testNews?_limit=2&_page=2', async () => {
      const { meta } = await client.get('/testNews?_limit=2&_page=2');
      expect(meta).toEqual({
        total: 3,
        limit: 2,
        skip: 0,
        page: 2,
        pages: 2,
        isFirstPage: false,
        isLastPage: true,
      });
    });

    test('GET /testNews?_skip=2&_limit=2', async () => {
      const { meta } = await client.get('/testNews?_skip=2&_limit=2');      
      expect(meta).toEqual({
        total: 3,
        limit: 2,
        skip: 2,
        page: 1,
        pages: 1,
        isFirstPage: true,
        isLastPage: true,
      });
    });
  });

  describe('empty results', () => {
    test('GET /testNews?_limit=3&_page=3', async () => {
      const { meta, result } = await client.get('/testNews?_limit=3&_page=3');
      expect(result).toEqual([]);
      expect(meta).toEqual({
        total: 3,
        limit: 3,
        skip: 0,
        page: 3,
        pages: 1,
        isFirstPage: false,
        isLastPage: true,
      });
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/permissions/hidden.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from '../../../src';
import { getTestClient } from '../../lib';

roles.init({
  root: ['*'],
  admin: ['testNews.getFullInfo'],
  manager: ['_.registered'],
  registered: ['testNews.getViews'],
});

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',
  hiddenFields: ['timeCreated', 'views'],

  permissions: {
    owner: ['testNews.getViews'],

    fields: {
      viewable: {
        'testNews.getFullInfo': ['timeCreated', 'views'],
        'testNews.getViews': ['views'],
      },
    }
  },

});

const theAPI = new TheAPI({ roles, routings: [router] });
const client = await getTestClient(theAPI);
const { tokens, users } = client;

describe('Hidden', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });

    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' });
      await client.post('/testNews', { name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
    });
  });

  describe('root token', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.root);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).not.toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.root);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('admin', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.admin);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).not.toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.admin);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('registered', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.registered);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.registered);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('manager', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.manager);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.manager);
      expect(result.views).not.toEqual(undefined);
    });
  });

  describe('no role', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', tokens.noRole);
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', tokens.noRole);
      expect(result.views).toEqual(undefined);
    });
  });

  describe('no token', () => {
    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id');
      expect(meta.total).toEqual(2);
      expect(result[0].timeCreated).toEqual(undefined);
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2');
      expect(result.views).toEqual(undefined);
    });
  });

  describe('owner', () => {
    test('create testNews', async () => {
      await client.post('/testNews', { userId: users.noRole.id, name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' });
      await client.post('/testNews', { userId: users.noRole.id, name: 'test112', views: 100, timeCreated: DateTime.fromISO('2024-06-01').toString() });
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=-id', tokens.noRole);
      expect(meta.total).toEqual(4);
      expect(result[0].views).not.toEqual(undefined);
    });

    test('GET /testNews/3', async () => {
      const { result } = await client.get('/testNews/3', tokens.noRole);
      expect(result.timeCreated).toEqual(undefined);
      expect(result.views).not.toEqual(undefined);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/permissions/methods.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from '../../../src';
import { getTestClient } from '../../lib';

roles.init({
  root: ['*'],
  admin: ['_.registered', 'testNews.*', 'testNewsDeletedProtected.*'],
  manager: ['_.registered', 'testNews.delete', 'testNewsDeletedProtected.delete'],
  registered: ['testNews.get', 'testNewsDeletedProtected.get'],
});

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',
  permissions: { methods: ['*'] },
});

router.crud({
  table: 'testNews',
  prefix: 'testNewsDeletedProtected',
  permissions: { methods: ['DELETE'] },
});

const theAPI = new TheAPI({ roles, routings: [router] });
const client = await getTestClient(theAPI);
const { tokens } = client;

describe('protected methods', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
    });

  describe('all protected', () => {
    describe('root token create/get', () => {
      test('create testNews', async () => {
        await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, tokens.root);
        await client.post('/testNews', { name: 'test112' }, tokens.root);
      });

      test('GET /testNews', async () => {
        const { result, meta } = await client.get('/testNews?_sort=id', tokens.root);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNews/1', async () => {
        const { result } = await client.get('/testNews/2', tokens.root);
        expect(result.name).toEqual('test112');
      });
    });

    describe('admin token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test333' }, tokens.admin);
        expect(result.name).toEqual('test333');
      });

      test('GET /testNews', async () => {
        const { result, meta } = await client.get('/testNews?_sort=id', tokens.admin);
        expect(meta.total).toEqual(3);
        expect(result[0].name).toEqual('test111');
      });
    });

    describe('registered token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test222' }, tokens.registered);
        expect(result.name).toEqual('ACCESS_DENIED');
      });

      test('GET /testNews', async () => {
        const { result, meta } = await client.get('/testNews?_sort=id', tokens.registered);
        expect(meta.total).toEqual(3);
        expect(result[0].name).toEqual('test111');
      });
    });

    describe('unknown token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test222' }, tokens.unknown);
        expect(result.name).toEqual('ACCESS_DENIED');
      });

      test('GET /testNews', async () => {
        const { result } = await client.get('/testNews?_sort=id', tokens.unknown);
        expect(result.name).toEqual('ACCESS_DENIED');
      });
    });

    describe('no token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNews', { name: 'test222' }, tokens.noToken);
        expect(result.name).toEqual('ACCESS_DENIED');
      });

      test('GET /testNews', async () => {
        const { result } = await client.get('/testNews?_sort=id', tokens.noToken);
        expect(result.name).toEqual('ACCESS_DENIED');
      });
    });

    test('trunicate tables', async () => {
      await client.truncateTables('testNews');
    });
  });

  describe('deleted protected', () => {
    describe('root token create/get/delete', () => {
      test('create testNews', async () => {
        await client.post('/testNewsDeletedProtected', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, tokens.root);
        await client.post('/testNewsDeletedProtected', { name: 'test112' }, tokens.root);
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.root);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.get('/testNewsDeletedProtected/5', tokens.root);
        expect(result.name).toEqual('test112');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/5', tokens.root);
        expect(result.ok).toEqual(true);
      });
    });

    describe('admin token create/get/delete', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test333' }, tokens.admin);
        expect(result.name).toEqual('test333');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.admin);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/6', tokens.admin);
        expect(result.ok).toEqual(true);
      });
    });

    describe('manager token create/get/delete', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test333' }, tokens.manager);
        expect(result.name).toEqual('test333');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.manager);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/7', tokens.manager);
        expect(result.ok).toEqual(true);
      });
    });

    describe('registered token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test222' }, tokens.registered);
        expect(result.name).toEqual('test222');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result, meta } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.registered);
        expect(meta.total).toEqual(2);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/8', tokens.registered);
        expect(result.error).toEqual(true);
      });
    });

    describe('unknown token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test222' }, tokens.unknown);
        expect(result.name).toEqual('test222');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result } = await client.get('/testNewsDeletedProtected?_sort=id', tokens.unknown);
        expect(result[0].name).toEqual('test111');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/8', tokens.registered);
        expect(result.error).toEqual(true);
      });
    });

    describe('no token create/get', () => {
      test('create testNews', async () => {
        const { result } = await client.post('/testNewsDeletedProtected', { name: 'test444' }, tokens.noToken);
        expect(result.name).toEqual('test444');
      });

      test('GET /testNewsDeletedProtected', async () => {
        const { result } = await client.get('/testNewsDeletedProtected?_sort=-id', tokens.noToken);
        expect(result[0].name).toEqual('test444');
      });

      test('GET /testNewsDeletedProtected/1', async () => {
        const { result } = await client.delete('/testNewsDeletedProtected/8', tokens.registered);
        expect(result.error).toEqual(true);
      });
    });

    test('trunicate tables', async () => {
      await client.truncateTables('testNews');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/permissions/roles.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { roles } from 'the-api-roles';
import { Routings, TheAPI } from '../../../src';
import { getTestClient } from '../../lib';

roles.init({
  root: ['*'],
  admin: ['_.registered', 'users.getFullInfo', 'users.editEmail', 'testNews.*'],
  registered: ['testNews.get', 'users.get'],
});

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',

  hiddenFields: ['password', 'salt'], // they're hidden everywhere and 're also readonly
  readOnlyFields: ['roles', 'email', 'emailToChange'],

  permissions: {
    methods: ['*'], // => create permissions: S(table || prefix).[get|post|patch|put|delete]
    owner: ['users.delete', 'users.getFullInfo', 'users.editEmail'],

    fields: {
      viewable: {
        'users.getFullInfo': ['email', 'emailToChange', 'externalProfiles', 'deleted'],
      },
      editable: {
        'users.editEmail': ['email'],
        'users.editRoles': ['roles'],
      },
    }
  },
});

const theAPI = new TheAPI({ roles, routings: [router] });
const client = await getTestClient(theAPI);

const rootToken = client.generateGWT({ id: 1, roles: ['root'] });
const adminToken = client.generateGWT({ id: 2, roles: ['admin'] });
const registeredToken = client.generateGWT({ id: 3, roles: ['registered'] });
const unknownToken = client.generateGWT({ id: 4, roles: ['unknown'] });
const noToken = client.generateGWT({ id: 5 });

describe('Roles', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
    });

  describe('root token create/get', () => {
    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111', timePublished: 'NOW()', timeDeleted: 'NOW()' }, rootToken);
      await client.post('/testNews', { name: 'test112' }, rootToken);
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', rootToken);
      expect(meta.total).toEqual(2);
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews/1', async () => {
      const { result } = await client.get('/testNews/2', rootToken);
      expect(result.name).toEqual('test112');
    });
  });

  describe('admin token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test333' }, adminToken);
      expect(result.name).toEqual('test333');
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', adminToken);
      expect(meta.total).toEqual(3);
      expect(result[0].name).toEqual('test111');
    });
  });

  describe('registered token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test222' }, registeredToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });

    test('GET /testNews', async () => {
      const { result, meta } = await client.get('/testNews?_sort=id', registeredToken);
      expect(meta.total).toEqual(3);
      expect(result[0].name).toEqual('test111');
    });
  });

  describe('unknown token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test222' }, unknownToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });

    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id', unknownToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });
  });

  describe('no token create/get', () => {
    test('create testNews', async () => {
      const { result } = await client.post('/testNews', { name: 'test222' }, noToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });

    test('GET /testNews', async () => {
      const { result } = await client.get('/testNews?_sort=id', noToken);
      expect(result.name).toEqual('ACCESS_DENIED');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/relations.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';
import {type  CrudBuilderOptionsType } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

const typeDefinition: CrudBuilderOptionsType = { table: 'testTypes' };

router.crud(typeDefinition);

router.crud({
  table: 'testTypeAges',
  relations: {
    typeId: typeDefinition,
  },
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET relations', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testTypes', { name: 'type3' });
      await client.post('/testTypes', { name: 'type4' });
      await client.post('/testTypes', { name: 'type5' });
      await client.post('/testTypeAges', { age: '0-3', typeId: 1 });
      await client.post('/testTypeAges', { age: '3-6', typeId: 1 });
      await client.post('/testTypeAges', { age: '7-14', typeId: 1 });
      await client.post('/testTypeAges', { age: '7-14', typeId: 2 });
      await client.post('/testTypeAges', { age: '15-21', typeId: 2 });
      await client.post('/testTypeAges', { age: '22-99', typeId: 4 });
    });
  });

  describe('join', () => {
    test('GET /testTypeAges', async () => {
      const { relations } = await client.get('/testTypeAges');
      expect(relations).toEqual({
        typeId: {
          "1": {
            id: 1,
            name: "type1",
          },
          "2": {
            id: 2,
            name: "type2",
          },
          "4": {
            id: 4,
            name: "type4",
          },
        },
      });
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/search.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({
  table: 'testNews',
  searchFields: ['name'],
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET search', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testNews', { name: 'test111' });
      await client.post('/testNews', { name: 'test112' });
      await client.post('/testNews', { name: 'test222' });
      await client.post('/testNews', { name: '测试222' });
    });
  });

  describe('exact search', () => {
    test('GET /testNews?_search=test222', async () => {
      const { result } = await client.get('/testNews?_search=test222');
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('search 1 typo', () => {
    test('GET /testNews?_search=tst111', async () => {
      const { result } = await client.get('/testNews?_search=tst111');
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?_search=t%20st112', async () => {
      const { result } = await client.get('/testNews?_search=t%20st112');
      expect(result[0].name).toEqual('test112');
    });

    test('GET /testNews?_search=tust222', async () => {
      const { result } = await client.get('/testNews?_search=tust222');
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_search=etst111', async () => {
      const { result } = await client.get('/testNews?_search=etst111');
      expect(result[0].name).toEqual('test111');
    });
  });

  describe('search 1 typos and 1 insert/delete', () => {
    test('GET /testNews?_search=tst22', async () => {
      const { result } = await client.get('/testNews?_search=tst22');
      expect(result[0].name).toEqual('test222');
    });

    test('GET /testNews?_search=t%20st1113', async () => {
      const { result } = await client.get('/testNews?_search=t%20st1113');
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?_search=tust22', async () => {
      const { result } = await client.get('/testNews?_search=tust22');
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('search unicode', () => {
    test('GET /testNews?_search=测试222', async () => {
      const { result } = await client.get('/testNews?_search=测试222');
      expect(result[0].name).toEqual('测试222');
    });

    test('GET /testNews?_search=测%22222', async () => {
      const { result } = await client.get('/testNews?_search=测%22222');
      expect(result[0].name).toEqual('测试222');
    });

    test('GET /testNews?_search=测试试22', async () => {
      const { result } = await client.get('/testNews?_search=测试试22');
      expect(result[0].name).toEqual('测试222');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/simple.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testNews' });

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('simple CRUD requests', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /testNews', async () => {
    const { result } = await client.get('/testNews');

    expect(result).toEqual([]);
  });

  test('POST /testNews { name: \'test123\' }', async () => {
    const { result } = await client.post('/testNews', { name: 'test123',  });

    expect(result.name).toEqual('test123');
  });

  test('GET /testNews', async () => {
    const { result } = await client.get('/testNews');

    expect(result[0].name).toEqual('test123');
  });

  test('GET /testNews/1', async () => {
    const { result } = await client.get('/testNews/1');

    expect(result.name).toEqual('test123');
  });

  test('PATCH /testNews/1 { name: \'test321\' }', async () => {
    const { result } = await client.patch('/testNews/1', { name: 'test321' });
    
    expect(result.name).toEqual('test321');
  });

  test('GET /testNews/1', async () => {
    const { result } = await client.get('/testNews/1');

    expect(result.name).toEqual('test321');
  });

  test('PUT /testNews/1 { name: \'test111\' }', async () => {
    const { result } = await client.put('/testNews/1', { name: 'test111' });

    expect(result.name).toEqual('test111');
  });

  test('GET /testNews/1', async () => {
    const { result } = await client.get('/testNews/1');

    expect(result.name).toEqual('test111');
  });

  test('DELETE /testNews/1', async () => {
    const { result } = await client.delete('/testNews/1');
    
    expect(result.ok).toEqual(true);
  });

  test('GET /testNews/1', async () => {
    const { result } = await client.get('/testNews/1');

    expect(result.error).toEqual(true);
  });

  test('GET /testNews', async () => {
    const { result } = await client.get('/testNews');

    expect(result).toEqual([]);
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/crud/sort.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { DateTime } from'luxon';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'testTypes' });
router.crud({ table: 'testNews' });
router.crud({
  table: 'testNews',
  prefix: 'testAll',
  join: [
    {
      table: 'testTypes',
      where: '"testTypes".id = "testNews"."typeId"',
      field: 'name',
      alias: 'typeName',
    }
  ]
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('GET sort', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });
  
    test('create testNews', async () => {
      await client.post('/testTypes', { name: 'type1' });
      await client.post('/testTypes', { name: 'type2' });
      await client.post('/testNews', { name: 'test111', typeId: 1 });
      await client.post('/testNews', { name: 'test112', typeId: 1, timePublished: DateTime.local().setZone('America/New_York').toString()});
      await client.post('/testNews', { name: 'test222', typeId: 2 });
      await client.post('/testNews', { name: 'test222', typeId: 2 });
    });
  });

  describe('simple', () => {
    test('GET /testNews?_sort=name', async () => {
      const { result } = await client.get('/testNews?_sort=name');
      expect(result[0].name).toEqual('test111');
    });

    test('GET /testNews?_sort=-name', async () => {
      const { result } = await client.get('/testNews?_sort=-name');
      expect(result[0].name).toEqual('test222');
    });
  });

  describe('nested', () => {
    test('GET /testNews?_sort=-name,-id', async () => {
      const { result } = await client.get('/testNews?_sort=-name,-id');
      expect(result[0].id).toEqual(4);
    });

    test('GET /testNews?_sort=-name,id', async () => {
      const { result } = await client.get('/testNews?_sort=-name,id');
      expect(result[0].id).toEqual(3);
    });
  });

  describe('random', () => {
    test('GET /testNews?_sort=random()', async () => {
      const { result: r1 } = await client.get('/testNews?_sort=random()');
      let r2 = [...r1];
      for(let i = 0; i<100; i++) {
        const { result } = await client.get('/testNews?_sort=random()');
        if (result[0].id != r1[0].id) {
          r2 = result;
          break;
        }
      }
      expect(r1[0].id != r2[0].id).toEqual(true);
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});
```

### test/db/db.spec.ts
```ts
import { expect, test, describe } from 'bun:test';
import { getTestClient } from '../lib';
import { Routings, TheAPI } from '../../src';
import type { AppContext } from '../../src';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.get('/check-migration', async (c: AppContext) => {
  await c.var.dbWrite('testNews').insert({ name: 'test' });
  c.set('result', await c.var.db('testNews'));
});

const theAPI = new TheAPI({ routings: [router] });
const client = await getTestClient(theAPI);

describe('DB', async () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /check-migration', async () => {
    const { result } = await client.get('/check-migration');
    expect(result[0].name).toEqual('test');
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
```

### test/email.spec.ts
```ts
import { describe, expect, test } from 'bun:test';
import { Routings } from 'the-api-routings';
import { getTestClient } from './lib';
import { TheAPI, middlewares } from '../src';
import type { AppContext } from '../src';

const router = new Routings();

router.get('/email_text', async (c: AppContext) => {
  await c.var.email({ to: 'test@test', subject: 'hi', text: 'hi2' });
});

router.get('/email_template1', async (c: AppContext) => {
  await c.var.email({ to: 'test@test', template: 'testTemplate1' });
});

router.get('/email_template2', async (c: AppContext) => {
  await c.var.email({ to: 'test@test', template: 'testTemplate2' });
});

router.get('/email_data', async (c: AppContext) => {
  await c.var.email({
    to: 'test@test',
    template: 'testData',
    data: { name: { firstName: 'aa' } },
  });
});

router.emailTemplates({
  testTemplate1: { subject: 'aa', text: 'aa2' },
});

const emailTemplates = {
  testTemplate2: { subject: 'bb', text: 'bb2' },
  testData: { subject: '{{name.firstName}}!', text: 'Hello, {{name.firstName}}' },
};

const theAPI = new TheAPI({
  emailTemplates,
  routings: [middlewares.errors, middlewares.email, router],
});
const client = await getTestClient(theAPI);

describe('email', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /email_text', async () => {
    await client.get('/email_text');
    expect((client.getValue('email') as any).html).toEqual('hi2');
  });

  test('GET /email_template1', async () => {
    await client.get('/email_template1');
    expect((client.getValue('email') as any).html).toEqual('aa2');
  });

  test('GET /email_template2', async () => {
    await client.get('/email_template2');
    expect((client.getValue('email') as any).html).toEqual('bb2');
  });

  test('GET /email_data', async () => {
    await client.get('/email_data');
    const stored = client.getValue('email') as any;
    expect(stored.subject).toEqual('aa!');
    expect(stored.html).toEqual('Hello, aa');
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
```

### test/errors.spec.ts
```ts
import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { Routings, TheAPI } from '../src';
import { errors } from '../src/middlewares';

const router = new Routings();

router.get('/exception', async (c: any) => {
  c.this.line.throws.error();
});

router.get('/error', async () => {
  throw new Error('throw error');
});

router.get('/user-defined-error', async () => {
  throw new Error('USER_DEFINED_ERROR');
});

router.get('/user-defined-error-addition', async (c: any) => {
  try {
    c.some.path();
  } catch (err) {
    throw new Error('USER_DEFINED_ERROR: additional information');
  }
});

router.get('/user-defined-error-message-meta', async (c: any) => {
  try {
    c.some.path();
  } catch {
    c.set('meta', { x: 3 });
    throw new Error('error message');
  }
});

router.errors({
  USER_DEFINED_ERROR: {
    code: 55,
    status: 403,
    description: 'user defined error',
  }
});

const theAPI = new TheAPI({ routings: [errors, router] });
const client = await getTestClient(theAPI);

describe('errors', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /not/found', async () => {
    const { result, ...r } = await client.get('/not/found');

    expect(result.error).toEqual(true);
    expect(result.status).toEqual(404);
  });

  test('GET /exception', async () => {
    const { result } = await client.get('/exception');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('An unexpected error occurred');
    expect(result.status).toEqual(500);
    expect(result.code).toEqual(11);
  });

  test('GET /error', async () => {
    const { result } = await client.get('/error');

    expect(result.error).toEqual(true);
    expect(result.name).toEqual('throw error');
    expect(result.description).toEqual('An unexpected error occurred');
    expect(result.status).toEqual(500);
    expect(result.code).toEqual(11);
  });

  test('GET /user-defined-error', async () => {
    const { result } = await client.get('/user-defined-error');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('user defined error');
    expect(result.status).toEqual(403);
    expect(result.code).toEqual(55);
  });

  test('GET /user-defined-error-addition', async () => {
    const { result } = await client.get('/user-defined-error-addition');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('user defined error');
    expect(result.additional).toEqual('additional information');
    expect(result.status).toEqual(403);
    expect(result.code).toEqual(55);
  });

  test('GET /user-defined-error-message-meta', async () => {
    const { result, meta } = await client.get('/user-defined-error-message-meta');

    expect(result.error).toEqual(true);
    expect(result.description).toEqual('An unexpected error occurred');
    expect(result.name).toEqual('error message');
    expect(result.status).toEqual(500);
    expect(result.code).toEqual(11);
    expect(meta).toEqual({ x: 3 });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});```

### test/files.spec.ts
```ts
import { describe, test, expect } from 'bun:test';
import { Routings } from 'the-api-routings';
import { getTestClient } from './lib';
import { TheAPI, middlewares } from '../src';
import type { AppContext } from '../src';

const router = new Routings();

router.post('/upload', async (c: AppContext) => {
  const body = await c.req.parseBody();
  const result = await c.var.files.upload(body.file as File, 'uploads');
  c.set('result', result);
});

router.post('/upload_files', async (c: AppContext) => {
  const body = await c.req.parseBody();
  const file = body['files[]'] as File;
  const result = await c.var.files.upload(file, 'uploads');
  c.set('result', result);
});

const theAPI = new TheAPI({
  port: 7788,
  routings: [middlewares.files, router],
});
const client = await getTestClient(theAPI);

describe('files', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('POST /upload', async () => {
    const file = await client.readFile('./test/static/123.txt');
    const res = await client.postFormRequest('/upload', { file });
    const json = await res?.json();
    expect(json.result.name).toEqual('123.txt');
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
```

### test/info.status.spec.ts
```ts
import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { TheAPI } from '../src';
import { info, logs, status } from '../src/middlewares';

const theAPI = new TheAPI({ routings: [logs, status, info] });
const client = await getTestClient(theAPI);

describe('info', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('GET /status', async () => {
    const { result } = await client.get('/status');

    expect(result.ok).toEqual(1);
  });

  test('GET /info', async () => {
    const { result } = await client.get('/info');

    expect(result.totalRequests).toEqual(1);
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});```

### test/init.ts
```ts
import { beforeAll, afterAll, mock } from 'bun:test';
import { getTestClient } from './lib';

const c = await getTestClient();

mock.module('nodemailer', () => ({
  createTransport: () => ({ sendMail: (data) => { c.storeValue('email', data) } }),
}));

beforeAll(async () => {
  await c.deleteTables();
});

afterAll(async () => {
  await c.deleteTables();
});
```

### test/langs.spec.ts
```ts
import { describe, expect, test } from 'bun:test';
import { getTestClient } from './lib';
import { Routings, TheAPI } from '../src';
import { langs } from 'the-api-langs';

const router = new Routings({ migrationDirs: ['./test/migrations'] });

router.crud({ table: 'langs' });

router.crud({
  table: 'testNews',
  translate: ['name'],
  searchFields: ['name'],
});

const theAPI = new TheAPI({ routings: [langs, router] });
const client = await getTestClient(theAPI);

describe('langs', () => {
  describe('init', () => {
    test('init', async () => {
      await theAPI.init();
    });

    test('create testNews', async () => {
      await client.post('/langs', { textKey: 1, lang: 'en', text: 'test111' });
      await client.post('/langs', { textKey: 1, lang: 'cn', text: '测试111' });
      await client.post('/langs', { textKey: 2, lang: 'en', text: 'test222' });
      await client.post('/langs', { textKey: 2, lang: 'cn', text: '测试222' });
      await client.post('/testNews', { name: 'test111' });
      await client.post('/testNews', { name: 'test222' });
    });
  });

  describe('translate', () => {
    test('GET /testNews?_lang=cn', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn');
      expect(result).toEqual([
        {
          name: "测试111",
        }, {
          name: "测试222",
        }      
      ]);
    });

    test('GET /testNews/1?_fields=name&_lang=cn', async () => {
      const { result } = await client.get('/testNews/1?_fields=name&_lang=cn');
      expect(result).toEqual({ name: "测试111" });
    });

    test('GET /testNews/1?_fields=name&_lang=cn&name=测试111', async () => {
      const { result } = await client.get('/testNews/1?_fields=name&_lang=cn');
      expect(result).toEqual({ name: "测试111" });
    });

    test('GET /testNews?_lang=en&name=test111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=en&name=test111');
      expect(result).toEqual([
        {
          name: "test111",
        }      
      ]);
    });

    test('GET /testNews?_fields=name&_lang=cn&name=test111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&name=test111');
      expect(result).toEqual([]);
    });

    test('GET /testNews?_lang=cn&_search=test11', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&_search=test11');
      expect(result).toEqual([]);
    });

    test('GET /testNews?_lang=cn&name=测试111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&name=测试111');
      expect(result).toEqual([
        {
          name: "测试111",
        }      
      ]);
    });

    test('GET /testNews?_lang=cn&_search=测试11', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&_search=测试11');
      expect(result[0].name).toEqual('测试111');
    });

    test('GET /testNews?_lang=cn&_search=测111', async () => {
      const { result } = await client.get('/testNews?_fields=name&_lang=cn&_search=测111');
      expect(result[0].name).toEqual('测试111');
    });
  });

  test('finalize', async () => {
    await client.deleteTables()
  });
});```

### test/lib.ts
```ts
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { testClient } from 'hono/testing';
import { TheAPI } from '../src/index.ts';
import { Db } from '../src/Db.ts';
import type { Knex } from 'knex';
import type { IncomingHttpHeaders } from 'http';
import type { MethodType, TheApiOptionsType } from '../src/types.ts';
import type { Hono, HttpPostBodyType, TestLibParamsType } from './types.ts';

const { db } = new Db();

export class TestClient {
  private app: Hono | undefined;
  private headers?: IncomingHttpHeaders;
  private vars: Record<string, unknown> = {};
  db: Knex;
  tokens: Record<string, string> = {};
  users: Record<
    string,
    { id: number; roles?: string[]; token?: string }
  > = {
    root: { id: 1, roles: ['root'] },
    admin: { id: 2, roles: ['admin'] },
    registered: { id: 3, roles: ['registered'] },
    manager: { id: 4, roles: ['manager'] },
    unknown: { id: 5, roles: ['unknown'] },
    noRole: { id: 6 },
    noToken: { id: 0 },
  };

  constructor(options?: TestLibParamsType) {
    const { app, headers } = options || {};
    if (app) this.app = app;
    if (headers) this.headers = headers;
    this.db = db;

    for (const role of Object.keys(this.users)) {
      const user = this.users[role];
      if (!user) continue;
      if (role === 'noToken') {
        this.tokens[role] = '';
        continue;
      }
      user.token = this.generateGWT(user);
      this.tokens[role] = user.token;
    }
  }

  async init({ app, headers }: TestLibParamsType): Promise<void> {
    this.app = app;
    this.headers = headers;
  }

  async deleteTables(): Promise<void> {
    const tables = await db.raw(
      `SELECT table_name, table_schema
       FROM information_schema.tables
       WHERE table_schema = current_schema()
          OR table_schema = 'prefabs'
         AND table_catalog = 'postgres'`,
    );
    for (const { table_name, table_schema } of tables.rows) {
      await db.raw(
        `DROP TABLE IF EXISTS "${table_schema}"."${table_name}" CASCADE`,
      );
    }
    await db.raw('DROP EXTENSION IF EXISTS pg_trgm');
    await db.raw(
      'DROP FUNCTION IF EXISTS collections_time_deleted CASCADE',
    );
    await db.raw('DROP FUNCTION IF EXISTS maps_time_deleted CASCADE');
    await db.raw(
      'DROP FUNCTION IF EXISTS prefabs_time_deleted CASCADE',
    );
  }

  async truncateTables(tables: string[] | string): Promise<void> {
    for (const table of ([] as string[]).concat(tables)) {
      await db(table).del();
    }
  }

  async getClient(options: TheApiOptionsType) {
    const theAPI = new TheAPI(options);
    await theAPI.init();
    return theAPI.app;
  }

  async request(
    method: MethodType,
    path: string,
    body?: HttpPostBodyType,
    token?: string,
  ) {
    const options = {
      headers: token
        ? { Authorization: `BEARER ${token}` }
        : this.headers,
    };
    const pathArr = path.split('/').slice(1);
    const client = testClient<any>(this.app);

    const res = await pathArr.reduce(
      (acc: any, key) => acc[key],
      client,
    )[`$${method}`](body, options);

    return res.json();
  }

  async get(path: string, token?: string) {
    return this.request('GET', path, undefined, token);
  }

  async post(path: string, json: HttpPostBodyType, token?: string) {
    return this.request('POST', path, { json }, token);
  }

  async postForm(path: string, form: HttpPostBodyType, token?: string) {
    return this.request('POST', path, { form }, token);
  }

  async postFormRequest(
    path: string,
    obj: Record<string, unknown>,
    token?: string,
  ) {
    const body = new FormData();

    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val)) {
        val.map((v) => body.append(`${key}[]`, v as Blob));
      } else {
        body.append(key, val as Blob);
      }
    }

    const headers = (
      token ? { Authorization: `BEARER ${token}` } : this.headers
    ) as HeadersInit;

    const req = new Request(`http://localhost:7788${path}`, {
      method: 'POST',
      body,
      headers,
    });

    return this.app?.fetch(req);
  }

  async patch(path: string, json: HttpPostBodyType, token?: string) {
    return this.request('PATCH', path, { json }, token);
  }

  async put(path: string, json: HttpPostBodyType, token?: string) {
    return this.request('PUT', path, { json }, token);
  }

  async delete(path: string, token?: string) {
    return this.request('DELETE', path, undefined, token);
  }

  generateGWT(
    params: Record<string, unknown>,
    expiresIn: string = process.env.JWT_EXPIRES_IN || '1h',
  ): string {
    return jwt.sign(params, process.env.JWT_SECRET || '', { expiresIn });
  }

  storeValue(key: string, value: unknown): void {
    this.vars[key] = value;
  }

  getValue(key: string): unknown {
    return this.vars[key];
  }

  async readFile(filePath: string): Promise<File> {
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    return new File([fileBuffer], fileName);
  }
}

let instance: TestClient;

export async function getTestClient(
  options?: TestLibParamsType,
): Promise<TestClient> {
  if (!instance) {
    instance = new TestClient();
  }
  if (options) await instance.init(options);
  return instance;
}
```

### test/types.ts
```ts
import type { IncomingHttpHeaders } from 'http';
import type { Hono } from 'hono';

export type { MethodType } from '../src/types';

type bodyType = string | number | boolean | HttpPostBodyType;

export type HttpPostBodyType = {
  [key: string]: bodyType | bodyType[];
};

export type TestLibParamsType = {
  app: Hono;
  headers?: IncomingHttpHeaders;
};

export type { Hono };
```

