import { describe, expect, test } from 'bun:test';
import { createRoutings, testClient } from './lib';
import type { AppContext, Next } from '../src';

const router = createRoutings({});

router.get('/query', async (c: AppContext, next: Next) => {
  c.var.appendQueryParams({
    userId: c.var.user.userId as number,
    modified: true,
    tags: ['api', 'docs'],
    removeMe: null,
  });
  await next();
});

router.get('/query', async (c: AppContext) => {
  c.set('result', c.var.query);
});

const { client, theAPI } = await testClient({ routings: [router] });

describe('appendQueryParams', () => {
  test('updates normalized query params for next handlers', async () => {
    const token = client.tokens.admin;
    const res = await theAPI.app.fetch(new Request(
      'http://localhost:7788/query?userId=1&removeMe=1',
      {
        headers: {
          Authorization: `BEARER ${token}`,
        },
      },
    ));

    const data = await res.json();

    expect(data.result).toEqual({
      modified: 'true',
      tags: ['api', 'docs'],
      userId: '2',
    });
  });
});
