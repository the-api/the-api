import jwt from 'jsonwebtoken';
import { Routings } from 'the-api-routings';
import { randomUUID } from 'crypto';
import type { Next } from 'hono';
import type { AppContext, QueryParamValue, RoutesErrorType } from '../types';
import { getErrorNameAndAdditional } from '../errorHelpers';
import {
  appendQueryParams,
  getNormalizedQuery,
  parseRequestBody,
} from '../requestState';

const { JWT_SECRET } = process.env;
const secret = JWT_SECRET || randomUUID();

const beginMiddleware = async (c: AppContext, next: Next) => {
  const dateBegin = new Date();

  // -- base services (may be overridden by errors middleware) --
  c.set('log', console.log);
  c.set('error', (err: Error | { message: string }) => {
    const { name, additional } = getErrorNameAndAdditional(err);

    const getErr = c.get('getErrorByMessage');
    const errObj: RoutesErrorType | undefined = getErr?.(name);

    c.set('result', { error: true, ...errObj, name, additional });
    if (errObj?.status) c.status(errObj.status as any);
  });
  const syncQuery = (params?: Record<string, QueryParamValue>): void => {
    const query = params
      ? appendQueryParams(c, params)
      : getNormalizedQuery(c);
    c.set('query', query);
  };
  const appendQueryParamsHandler = (
    params: Record<string, QueryParamValue>,
  ): void => {
    syncQuery(params);
  };
  c.set('appendQueryParams', appendQueryParamsHandler);
  syncQuery();

  const { body, bodyType } = await parseRequestBody(c);
  c.set('body', body);
  c.set('bodyType', bodyType);

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
  } else {
    // Requests without token are treated as guest users for roles middleware.
    c.set('user', { roles: ['guest'] });
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
  VALIDATION_ERROR: {
    code: 22,
    status: 400,
    description: 'Validation error',
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
