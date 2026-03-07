import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext, RoutesErrorType } from '../../types';
import { getErrorNameAndAdditional } from '../../errorHelpers';

const errorMiddleware = async (c: AppContext, n: Next) => {
  c.set('error', (err: Error | { message: string }) => {
    const m = 'message' in err ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    let { name, additional } = getErrorNameAndAdditional(err);

    const getErr = c.get('getErrorByMessage');
    let errorObj: RoutesErrorType | undefined = getErr?.(name);

    if (!errorObj) {
      errorObj = getErr?.('DEFAULT');
      name = m;
      additional = [];
    }

    c.set('result', { ...errorObj, name, additional, stack, error: true });
    c.status((errorObj?.status || 500) as any);
  });

  await n();
};

const errors = new Routings();
errors.use('*', errorMiddleware);

export { errors };
