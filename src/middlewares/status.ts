import { Routings } from 'the-api-routings';
import type { AppContext } from '../types';

const status = new Routings();

status.get('/status', async (c: AppContext) => c.set('result', { ok: 1 }));

export { status };
