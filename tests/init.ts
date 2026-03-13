import { beforeAll, afterAll, mock } from 'bun:test';
import type { TestClient } from './lib';

let c: TestClient;

process.env.DB_POOL_MIN ??= '0';
process.env.DB_POOL_MAX ??= '1';
process.env.DB_WRITE_POOL_MIN ??= '0';
process.env.DB_WRITE_POOL_MAX ??= '1';

mock.module('nodemailer', () => ({
  createTransport: () => ({ sendMail: (data: unknown) => { c?.storeValue('email', data); } }),
}));

const { getTestClient } = await import('./lib');
c = await getTestClient();

beforeAll(async () => {
  await c.deleteTables();
});

afterAll(async () => {
  await c.deleteTables();
});
