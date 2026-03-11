import { describe, test, expect } from 'bun:test';
import { createRoutings, testClient } from './lib';
import { middlewares } from '../src';
import type { AppContext } from '../src';

const router = createRoutings();
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

const { theAPI, client } = await testClient({
  routings: [middlewares.files, router],
  theApiOptions: { port: 7788 },
});

describe('files', () => {
  test('init', async () => {
    await theAPI.init();
  });

  test('POST /upload', async () => {
    const file = await client.readFile('./tests/static/123.txt');
    const res = await client.postFormRequest('/upload', { file });
    const json = await res?.json();
    expect(json.result.name).toEqual('123.txt');
  });

  test('finalize', async () => {
    await client.deleteTables();
  });
});
