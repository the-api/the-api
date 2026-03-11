import { beforeAll, afterAll, mock } from 'bun:test';
import type { TestClient } from './lib';

let c: TestClient;

mock.module('nodemailer', () => ({
  createTransport: () => ({ sendMail: (data: unknown) => { c?.storeValue('email', data); } }),
}));

const { testClient } = await import('./lib');
({ client: c } = await testClient());

beforeAll(async () => {
  await c.deleteTables();
});

afterAll(async () => {
  await c.deleteTables();
});
