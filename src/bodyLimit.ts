import { bodyLimit as honoBodyLimit } from 'hono/body-limit';
import type { Context } from 'hono';

type OnError = (c: Context) => Response | Promise<Response>;

type BodyLimitOptions = {
  maxSize: number;
  onError?: OnError;
};

const defaultOnError = (c: Context) => c.json({
  result: {
    error: true,
    name: 'Payload Too Large',
    status: 413,
    code: 0,
    additional: [],
  },
  relations: c.get('relations'),
  meta: c.get('meta'),
  error: true,
  serverTime: new Date().toISOString(),
  logId: c.get('logId'),
}, 413);

export const bodyLimit = (options: BodyLimitOptions) => honoBodyLimit({
  ...options,
  onError: options.onError || defaultOnError,
});
