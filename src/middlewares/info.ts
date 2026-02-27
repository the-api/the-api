import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext } from '../types';

const file = Bun.file('./package.json');
const { name, version } = await file.json();

const startTime = new Date();
let totalRequests = 0;

const countMiddleware = async (_c: AppContext, n: Next) => {
  totalRequests++;
  await n();
};

const infoMiddleware = async (c: AppContext) => {
  const uptime = Math.floor((+new Date() - +startTime) / 1000);

  c.set('result', { startTime, uptime, totalRequests, name, version });
};

const info = new Routings();
info.use('*', countMiddleware);
info.get('/info', infoMiddleware);

export { info };
