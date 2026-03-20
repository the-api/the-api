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

const getBodyForLogs = (c: AppContext): unknown => {
  const contentType = c.req.raw.headers.get('content-type') || '';

  if (contentType.startsWith('multipart/form-data')) {
    return '[multipart form-data omitted]';
  }

  if (c.var.bodyType === 'arrayBuffer') {
    return `[${(c.var.body as ArrayBuffer)?.byteLength || 0} bytes]`;
  }

  return c.var.body;
};

const logMiddleware = async (c: AppContext, n: Next) => {
  const startTime = new Date();
  const { method, headers } = c.req.raw;
  const id = Math.random().toString(36).substring(2, 10);
  c.set('logId', id);

  const { path } = c.req;
  c.set('log', createLogger({ id, startTime, method, path }));

  const ip = c.env?.ip?.address;
  const query = { ...c.var.query };
  const body = getBodyForLogs(c);

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
