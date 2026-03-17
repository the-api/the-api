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
import type { CrudBuilderOptionsType, Routings as RoutingsType } from 'the-api-routings';
import type { MethodType, RoutingsInputType, TheApiOptionsType } from './types';

type BodyType = string | number | boolean | HttpPostBodyType;

export type HttpPostBodyType = {
  [key: string]: BodyType | BodyType[];
};

export type TestClientInitType = {
  app: Hono<any>;
  headers?: IncomingHttpHeaders;
};

export type TestClientUserType = {
  id: number;
  userId?: number;
  roles?: string[];
  token?: string;
};

export type TestClientUsersType = Record<string, TestClientUserType>;
export type TestClientTokensType = Record<string, string>;
export type TestClientRolesConfigType = Record<string, string[]>;

export type TestClientOptionsType = {
  migrationDirs?: string[];
  routingOptions?: {
    migrationDirs?: string[];
  };
  crudParams?: CrudBuilderOptionsType[];
  roles?: Roles | TestClientRolesConfigType;
  routings?: RoutingsInputType;
  newRoutings?: (router: Routings) => void;
  theApiOptions?: Omit<TheApiOptionsType, 'routings' | 'roles' | 'migrationDirs'>;
};

const { db } = new Db();
let instance: TestClient;

export function createRoutings(options?: { migrationDirs?: string[] }) {
  return new Routings(options);
}

export class TestClient {
  private app: Hono<any> | undefined;
  private headers?: IncomingHttpHeaders;
  private vars: Record<string, unknown> = {};
  db: Knex;
  tokens: TestClientTokensType = {};
  users: TestClientUsersType = {
    root: { id: 1, userId: 1, roles: ['root'] },
    admin: { id: 2, userId: 2, roles: ['admin'] },
    registered: { id: 3, userId: 3, roles: ['registered'] },
    manager: { id: 4, userId: 4, roles: ['manager'] },
    unknown: { id: 5, userId: 5, roles: ['unknown'] },
    noRole: { id: 6, userId: 6 },
  };

  constructor(options?: TestClientInitType) {
    const { app, headers } = options || {};
    if (app) this.app = app;
    if (headers) this.headers = headers;
    this.db = db;
    this.tokens.noToken = '';

    for (const role of Object.keys(this.users)) {
      const user = this.users[role];
      if (!user) continue;
      user.token = this.generateGWT(user);
      this.tokens[role] = user.token;
    }
  }

  async init({ app, headers }: TestClientInitType): Promise<void> {
    this.app = app;
    this.headers = headers;
  }

  async deleteTables(): Promise<void> {
    const tables = await db.raw(
      `SELECT table_name, table_schema
       FROM information_schema.tables
       WHERE table_catalog = current_database()
         AND (
           table_schema = current_schema()
           OR table_schema = 'public'
         )`,
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

  async get(pathName: string, token?: string) {
    return this.request('GET', pathName, undefined, token);
  }

  async post(pathName: string, json: HttpPostBodyType, token?: string) {
    return this.request('POST', pathName, { json }, token);
  }

  async postForm(pathName: string, form: HttpPostBodyType, token?: string) {
    return this.request('POST', pathName, { form }, token);
  }

  async postFormRequest(
    pathName: string,
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

    const req = new Request(`http://localhost:7788${pathName}`, {
      method: 'POST',
      body,
      headers,
    });

    return this.app?.fetch(req);
  }

  private appendFormValue(
    body: FormData,
    key: string,
    value: unknown,
  ): void {
    if (value === undefined) {
      return;
    }

    if (value instanceof Blob) {
      body.append(key, value);
      return;
    }

    body.append(key, String(value));
  }

  async patch(pathName: string, json: HttpPostBodyType, token?: string) {
    return this.request('PATCH', pathName, { json }, token);
  }

  async delete(pathName: string, token?: string) {
    return this.request('DELETE', pathName, undefined, token);
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

type TestClientResultType = {
  client: TestClient;
  theAPI: TheAPI;
  DateTime: typeof DateTime;
  tokens: TestClientTokensType;
  users: TestClientUsersType;
  db: Knex;
};

export async function getTestClient(
  options?: TestClientInitType,
): Promise<TestClient> {
  if (!instance) {
    instance = new TestClient();
  }
  if (options) await instance.init(options);
  return instance;
}

const isRolesInstance = (value: unknown): value is Roles =>
  !!value && typeof (value as Roles).addRoutePermissions === 'function';

export async function testClient(
  options?: TestClientOptionsType,
): Promise<TestClientResultType> {
  const {
    crudParams = [],
    migrationDirs,
    routingOptions,
    roles,
    routings = [],
    newRoutings,
    theApiOptions = {},
  } = options || {};

  const allRoutings = [...routings];
  const flatRoutings = allRoutings.flat() as RoutingsType[];

  if (crudParams.length || migrationDirs?.length || routingOptions?.migrationDirs?.length) {
    const crudRouting = new Routings({
      migrationDirs: routingOptions?.migrationDirs || migrationDirs,
    });
    for (const params of crudParams) {
      crudRouting.crud(params);
    }
    allRoutings.push(crudRouting);
  }

  if (newRoutings) {
    const customRouting = new Routings({
      migrationDirs: routingOptions?.migrationDirs || migrationDirs,
    });
    newRoutings(customRouting);
    allRoutings.push(customRouting);
  }

  let rolesInstance: Roles | undefined;
  if (roles) {
    if (isRolesInstance(roles)) {
      rolesInstance = roles;
    } else {
      rolesInstance = new Roles(roles);
    }
  }

  const theAPI = new TheAPI({
    ...theApiOptions,
    routings: allRoutings,
    migrationDirs: flatRoutings.some(
      (routing) => Array.isArray((routing as { migrationDirs?: unknown }).migrationDirs),
    ) ? undefined : migrationDirs,
    roles: rolesInstance,
  });

  const bunTest = await import('bun:test').catch(() => null);
  bunTest?.afterAll?.(async () => {
    await theAPI.destroy();
  });

  const client = await getTestClient({ app: theAPI.app });
  const { tokens, users } = client;
  return { client, theAPI, DateTime, tokens, users, db };
}
