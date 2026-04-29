import jwt from 'jsonwebtoken';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DateTime } from 'luxon';
import { testClient as honoTestClient } from 'hono/testing';
import Roles from 'the-api-roles';
import { Routings } from 'the-api-routings';
import { Db } from './Db';
import { TheAPI } from './TheApi';
import type { Knex } from 'knex';
import type { IncomingHttpHeaders } from 'http';
import type { Hono } from 'hono';
import type {
  CrudBuilderOptionsType,
  Routings as RoutingsType,
} from 'the-api-routings';
import type {
  MethodType,
  RoutingsInputType,
  TheApiOptionsType,
} from './types';

// ======================== Types ========================

type BodyType = string | number | boolean | HttpPostBodyType;

export type HttpPostBodyType = {
  [key: string]: BodyType | BodyType[];
};

export type TestClientUserType = {
  userId: number;
  roles?: string[];
  token?: string;
};

export type TestClientUsersType = Record<string, TestClientUserType>;
export type TestClientTokensType = Record<string, string>;
export type TestClientRolesConfigType = Record<string, string[]>;

export type TestClientOptionsType = {
  migrationDirs?: string[];
  crudParams?: CrudBuilderOptionsType[];
  roles?: Roles | TestClientRolesConfigType;
  routings?: RoutingsInputType;
  newRoutings?: (router: Routings) => void;
  beforeInit?: (theAPI: TheAPI) => void | Promise<void>;
  theApiOptions?: Omit<
    TheApiOptionsType,
    'routings' | 'roles' | 'migrationDirs'
  >;
};

export type TestClientResultType = {
  client: TestClient;
  theAPI: TheAPI;
  DateTime: typeof DateTime;
  tokens: TestClientTokensType;
  users: TestClientUsersType;
  db: Knex;
};

// ======================== Constants ========================

const DEFAULT_USERS: Readonly<TestClientUsersType> = {
  root: { userId: 1, roles: ['root'] },
  admin: { userId: 2, roles: ['admin'] },
  registered: { userId: 3, roles: ['registered'] },
  manager: { userId: 4, roles: ['manager'] },
  unknown: { userId: 5, roles: ['unknown'] },
  noRole: { userId: 6 },
};

// ======================== Internal helpers ========================

// Lazy singleton — один пул на весь процесс, не на каждый тест-файл
let _db: Knex | null = null;
function getDb(): Knex {
  if (!_db) _db = new Db().db;
  return _db;
}

function generateToken(
  params: Record<string, unknown>,
  expiresIn: string = process.env.JWT_EXPIRES_IN || '1h',
): string {
  return jwt.sign(params, process.env.JWT_SECRET || '', { expiresIn });
}

/**
 * Каждый TestClient получает свою глубокую копию users/tokens,
 * чтобы мутации в одном тесте не влияли на другие.
 */
function createUsersWithTokens(): {
  users: TestClientUsersType;
  tokens: TestClientTokensType;
} {
  const users = structuredClone(DEFAULT_USERS) as TestClientUsersType;
  const tokens: TestClientTokensType = { noToken: '' };

  for (const [role, user] of Object.entries(users)) {
    if (!user) continue;
    user.token = generateToken(user);
    tokens[role] = user.token;
  }

  return { users, tokens };
}

const isRolesInstance = (v: unknown): v is Roles =>
  !!v && typeof (v as Roles).addRoutePermissions === 'function';

function buildRoles(
  roles?: Roles | TestClientRolesConfigType,
): Roles | undefined {
  if (!roles) return undefined;
  return isRolesInstance(roles) ? roles : new Roles(roles);
}

function buildRoutings(options: TestClientOptionsType): RoutingsInputType {
  const {
    crudParams = [],
    migrationDirs,
    routings = [],
    newRoutings,
  } = options;

  const result: RoutingsInputType = [...routings];

  if (
    crudParams.length ||
    migrationDirs?.length
  ) {
    const crudRouting = new Routings({ migrationDirs });
    for (const params of crudParams) {
      crudRouting.crud(params);
    }
    result.push(crudRouting);
  }

  if (newRoutings) {
    const customRouting = new Routings({ migrationDirs });
    newRoutings(customRouting);
    result.push(customRouting);
  }

  return result;
}

// ======================== TestClient ========================

export class TestClient {
  private readonly app: Hono<any>;
  private readonly headers?: IncomingHttpHeaders;
  private readonly vars: Record<string, unknown> = {};

  readonly db: Knex;
  readonly tokens: TestClientTokensType;
  readonly users: TestClientUsersType;

  /**
   * Конструктор принимает всё необходимое — объект сразу готов к работе,
   * никакого отложенного init().
   */
  constructor(app: Hono<any>, db: Knex, headers?: IncomingHttpHeaders) {
    this.app = app;
    this.db = db;
    this.headers = headers;

    const { users, tokens } = createUsersWithTokens();
    this.users = users;
    this.tokens = tokens;
  }

  // ----- Database helpers -----

  async deleteTables(): Promise<void> {
    const tables = await this.db.raw(
      `SELECT table_name, table_schema
       FROM information_schema.tables
       WHERE table_catalog = current_database()
         AND (table_schema = current_schema() OR table_schema = 'public')`,
    );
    for (const { table_name, table_schema } of tables.rows) {
      await this.db.raw(
        `DROP TABLE IF EXISTS "${table_schema}"."${table_name}" CASCADE`,
      );
    }
    await this.db.raw('DROP EXTENSION IF EXISTS pg_trgm');
  }

  async truncateTables(tables: string[] | string): Promise<void> {
    for (const table of ([] as string[]).concat(tables)) {
      await this.db(table).del();
    }
  }

  // ----- HTTP methods -----

  async request(
    method: MethodType,
    requestPath: string,
    body?: HttpPostBodyType,
    token?: string,
  ) {
    const options = {
      headers: token
        ? { Authorization: `BEARER ${token}` }
        : this.headers,
    };
    const pathArr = requestPath.split('/').slice(1);
    const client = honoTestClient<any>(this.app);

    const res = await pathArr.reduce(
      (acc: any, key) => acc[key],
      client,
    )[`$${method}`](body, options);

    return res.json();
  }

  async get(p: string, token?: string) {
    return this.request('GET', p, undefined, token);
  }

  async post(p: string, json: HttpPostBodyType, token?: string) {
    return this.request('POST', p, { json }, token);
  }

  async postForm(p: string, form: HttpPostBodyType, token?: string) {
    return this.request('POST', p, { form }, token);
  }

  async postFormRequest(
    p: string,
    obj: Record<string, unknown>,
    token?: string,
  ) {
    const body = new FormData();
    for (const [key, val] of Object.entries(obj)) {
      if (Array.isArray(val)) {
        val.forEach((item) => this.appendFormValue(body, key, item));
      } else {
        this.appendFormValue(body, key, val);
      }
    }
    const headers = (
      token ? { Authorization: `BEARER ${token}` } : this.headers
    ) as HeadersInit;
    const req = new Request(`http://localhost:7788${p}`, {
      method: 'POST',
      body,
      headers,
    });
    return this.app.fetch(req);
  }

  private appendFormValue(
    body: FormData,
    key: string,
    value: unknown,
  ): void {
    if (value === undefined) return;
    if (value instanceof Blob) {
      body.append(key, value);
      return;
    }
    body.append(key, String(value));
  }

  async patch(p: string, json: HttpPostBodyType, token?: string) {
    return this.request('PATCH', p, { json }, token);
  }

  async delete(p: string, token?: string) {
    return this.request('DELETE', p, undefined, token);
  }

  // ----- Utilities -----

  generateGWT(
    params: Record<string, unknown>,
    expiresIn?: string,
  ): string {
    return generateToken(params, expiresIn);
  }

  storeValue(key: string, value: unknown): void {
    this.vars[key] = value;
  }

  getValue(key: string): unknown {
    return this.vars[key];
  }

  async readFile(relativePath: string, type?: string): Promise<File> {
    const filePath = path.join(process.cwd(), relativePath);
    const buf = await fs.readFile(filePath);
    return new File([buf], path.basename(filePath), type && { type });
  }
}

// ======================== Factory ========================

export function createRoutings(
  options?: { migrationDirs?: string[] },
) {
  return new Routings(options);
}

async function dropAllTables(db: Knex): Promise<void> {
  const tables = await db.raw(
    `SELECT table_name, table_schema
     FROM information_schema.tables
     WHERE table_catalog = current_database()
       AND (table_schema = current_schema() OR table_schema = 'public')`,
  );
  for (const { table_name, table_schema } of tables.rows) {
    await db.raw(
      `DROP TABLE IF EXISTS "${table_schema}"."${table_name}" CASCADE`,
    );
  }
  await db.raw('DROP EXTENSION IF EXISTS pg_trgm');
}

/**
 * Главная точка входа для тестов.
 *
 * - Создаёт свежий TheAPI + TestClient на каждый вызов (без singleton)
 * - Автоматически вызывает theAPI.init()
 * - Автоматически регистрирует afterAll для очистки
 */
export async function testClient(
  options: TestClientOptionsType = {},
): Promise<TestClientResultType> {
  const db = getDb();

  // --- собираем конфигурацию ---
  const allRoutings = buildRoutings(options);
  const flatRoutings = allRoutings.flat() as RoutingsType[];
  const rolesInstance = buildRoles(options.roles);

  const hasMigrationDirsInRoutings = flatRoutings.some(
    (r) =>
      Array.isArray(
        (r as { migrationDirs?: unknown }).migrationDirs,
      ),
  );

  await dropAllTables(db);

  // --- создаём и инициализируем API ---
  const theAPI = new TheAPI({
    ...options.theApiOptions,
    routings: allRoutings,
    migrationDirs: hasMigrationDirsInRoutings
      ? undefined
      : options.migrationDirs,
    roles: rolesInstance,
  });

  await options.beforeInit?.(theAPI);
  await theAPI.init();

  // --- создаём изолированный клиент ---
  const client = new TestClient(theAPI.app, db);

  // --- автоматическая очистка ---
  const bunTest = await import('bun:test').catch(() => null);
  bunTest?.afterAll?.(async () => {
    await client.deleteTables();
    await theAPI.destroy();
  });

  const { tokens, users } = client;
  return { client, theAPI, DateTime, tokens, users, db };
}
