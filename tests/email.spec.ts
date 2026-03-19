import { describe, expect, mock, test } from 'bun:test';

let emailSink: unknown;

mock.module('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async (data: unknown) => {
      emailSink = data;
      return data;
    },
  }),
}));

const { createRoutings, testClient } = await import('./lib');
const { middlewares } = await import('../src');
type AppContext = import('../src').AppContext;

const router = createRoutings();

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

const { client } = await testClient({
  routings: [middlewares.errors, middlewares.email, router],
  theApiOptions: { emailTemplates },
});

describe('email', () => {
  test('GET /email_text', async () => {
    await client.get('/email_text');
    expect((emailSink as any).html).toEqual('hi2');
  });

  test('GET /email_template1', async () => {
    await client.get('/email_template1');
    expect((emailSink as any).html).toEqual('aa2');
  });

  test('GET /email_template2', async () => {
    await client.get('/email_template2');
    expect((emailSink as any).html).toEqual('bb2');
  });

  test('GET /email_data', async () => {
    await client.get('/email_data');
    const stored = emailSink as any;
    expect(stored.subject).toEqual('aa!');
    expect(stored.html).toEqual('Hello, aa');
  });
});
