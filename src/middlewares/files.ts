import { Routings } from 'the-api-routings';
import { Files } from '../Files';
import type { Next } from 'hono';
import type { AppContext } from '../types';

let filesInstance: Files | null = null;

const filesMiddleware = async (c: AppContext, next: Next) => {
  if (!filesInstance) filesInstance = new Files();
  c.set('files', filesInstance);
  await next();
};

const filesRoute = new Routings();
filesRoute.use('*', filesMiddleware);
filesRoute.errors({
  FILES_NO_STORAGE_CONFIGURED: {
    code: 131,
    status: 500,
    description: 'No file storage configured (set FILES_FOLDER or MINIO_*)',
  },
  FILES_NO_MINIO_CONFIGURED: {
    code: 132,
    status: 500,
    description: 'MinIO is not configured for this operation',
  },
});

export { filesRoute as files };
