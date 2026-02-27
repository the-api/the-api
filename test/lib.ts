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
