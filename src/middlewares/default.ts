import jwt from 'jsonwebtoken';
import { Routings } from 'the-api-routings';
import { randomUUID } from 'crypto';
import type { Next } from 'hono';
import type { AppContext, RoutesErrorType } from '../types';

const { JWT_SECRET } = process.env;
const secret = JWT_SECRET || randomUUID();

const beginMiddleware = async (c: AppContext, next: Next) => {
  const dateBegin = new Date();

  // -- base services (may be overridden by errors middleware) --
  c.set('log', console.log);
  c.set('error', (err: Error | { message: string }) => {
    const m = 'message' in err ? err.message : String(err);
    const match = m.match(/^(\w+):?\s?(.*?)$/);
    const name = match?.[1] ?? m;
    const additional = match?.[2] ?? '';

    const getErr = c.get('getErrorByMessage');
    const errObj: RoutesErrorType | undefined = getErr?.(name);

    c.set('result', { error: true, ...errObj, name, additional });
    if (errObj?.status) c.status(errObj.status as any);
  });

  // -- JWT --
  const token = c.req.raw.headers
    .get('authorization')
    ?.replace(/^bearer\s+/i, '');

  if (token) {
    try {
      c.set('user', jwt.verify(token, secret) as Record<string, unknown>);
    } catch {
      c.var.error(new Error('INVALID_TOKEN'));
      // return immediately - don't process the request
      return formatResponse(c, dateBegin);
    }
  }

  // -- downstream --
  if (!c.var.result) {
    try {
      await next();
    } catch (err) {
      c.var.error(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // -- 404 --
  if (!c.var.result) {
    c.var.error(new Error('NOT_FOUND'));
  }

  return formatResponse(c, dateBegin);
};

function formatResponse(c: AppContext, dateBegin: Date) {
  const { result, relations, meta, logId } = c.var;
  const error =
    typeof result === 'object' &&
    result !== null &&
    'error' in (result as Record<string, unknown>)
      ? (result as Record<string, unknown>).error
      : false;
  const date = new Date();

  return c.json({
    result,
    relations,
    meta,
    error,
    requestTime: +date - +dateBegin,
    serverTime: date.toISOString(),
    logId,
  });
}

const beginRoute = new Routings();
beginRoute.use('*', beginMiddleware);
beginRoute.errors({
  DEFAULT: {
    code: 11,
    status: 500,
    description: 'An unexpected error occurred',
  },
  ACCESS_DENIED: {
    code: 15,
    status: 403,
    description: 'Insufficient permissions',
  },
  NOT_FOUND: {
    code: 21,
    status: 404,
    description: 'Not found',
  },
  INVALID_TOKEN: {
    code: 25,
    status: 401,
    description: 'Invalid token. Try to renew it.',
  },
  ERROR_QUERY_VALUE: {
    code: 41,
    status: 409,
    description: 'Wrong value in query',
  },
});

// Sentinel: ensures the middleware chain has an endpoint
const endRoute = new Routings();
endRoute.use('*', async () => {});

export { beginRoute, endRoute };
