import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext, RoutesErrorType } from '../../types';

const errorMiddleware = async (c: AppContext, n: Next) => {
  c.set('error', (err: Error | { message: string }) => {
    const m = 'message' in err ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const match = m.match(/^(\w+):?\s?(.*?)$/);

    let name = match?.[1] ?? m;
    let additional = match?.[2] ?? '';

    const getErr = c.get('getErrorByMessage');
    let errorObj: RoutesErrorType | undefined = getErr?.(name);

    if (!errorObj) {
      errorObj = getErr?.('DEFAULT');
      name = m;
      additional = '';
    }

    c.set('result', { ...errorObj, name, additional, stack, error: true });
    c.status((errorObj?.status || 500) as any);
  });

  await n();
};

const errors = new Routings();
errors.use('*', errorMiddleware);

export { errors };
