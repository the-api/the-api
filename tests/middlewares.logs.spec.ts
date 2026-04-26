import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { Routings } from 'the-api-routings';
import { logs } from '../src/middlewares/logs';
import type { Next } from 'hono';
import type { AppContext, AppEnv } from '../src/types';

const app = new Hono<AppEnv>();
const honoApp = app as any;
const router = new Routings();

app.use('*', async (c: AppContext, next: Next) => {
  c.set('query', {});
  c.set('body', await c.req.json());
  c.set('bodyType', 'json');
  c.set('log', console.log);

  await next();

  return c.json({
    result: c.var.result,
    logId: c.var.logId,
  });
});

router.post('/logs/body', async (c: AppContext) => {
  const body = c.var.body as Record<string, unknown>;

  c.var.log({ routeBody: body });
  c.set('result', {
    password: body.password,
    token: body.token,
    nested: body.nested,
  });
});

router.post('/logs/manual', async (c: AppContext) => {
  const logged = {
    password: 'manual-secret',
    nested: {
      token: 'nested-secret',
    },
  };

  c.var.log(logged);
  c.set('result', logged);
});

for (const route of logs.routes) {
  honoApp.all(route.path, ...route.handlers);
}

for (const route of router.routes) {
  honoApp.post(route.path, ...route.handlers);
}

describe('middlewares.logs', () => {
  test('hides sensitive values without mutating request body', async () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };

    let response: { result: unknown };
    try {
      const res = await app.fetch(
        new Request('http://localhost:7788/logs/body', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            login: 'alice',
            password: 'secret-password',
            token: 'secret-token',
            nested: {
              refresh: 'secret-refresh',
              value: 'kept',
            },
          }),
        }),
      );
      response = await res.json();
    } finally {
      console.log = originalLog;
    }

    expect(response.result).toEqual({
      password: 'secret-password',
      token: 'secret-token',
      nested: {
        refresh: 'secret-refresh',
        value: 'kept',
      },
    });

    const output = lines.join('\n');

    expect(output).toContain('<hidden>');
    expect(output).not.toContain('secret-password');
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('secret-refresh');
  });

  test('hides sensitive values from c.var.log without mutating logged object', async () => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };

    let response: { result: unknown };
    try {
      const res = await app.fetch(
        new Request('http://localhost:7788/logs/manual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
      );
      response = await res.json();
    } finally {
      console.log = originalLog;
    }

    expect(response.result).toEqual({
      password: 'manual-secret',
      nested: {
        token: 'nested-secret',
      },
    });

    const output = lines.join('\n');

    expect(output).toContain('<hidden>');
    expect(output).not.toContain('manual-secret');
    expect(output).not.toContain('nested-secret');
  });
});
