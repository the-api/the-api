import { Routings } from 'the-api-routings';
import type { Next } from 'hono';
import type { AppContext } from '../types';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), './package.json'), 'utf-8'));
const { name, version } = packageJson;

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
