import { Routings } from 'the-api-routings';
import { Files } from '../Files';
import type { Next } from 'hono';
import type { AppContext, FilesOptions } from '../types';

const FILES_ERRORS = {
  FILES_INVALID_FILE: {
    code: 130,
    status: 400,
    description: 'Invalid uploaded file payload',
  },
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
  FILES_INVALID_IMAGE_SIZES_CONFIG: {
    code: 133,
    status: 500,
    description: 'IMAGE_SIZES must be in the format name:WIDTHxHEIGHT',
  },
};

const createFiles = (options?: FilesOptions): Routings => {
  let filesInstance: Files | null = null;

  const filesMiddleware = async (c: AppContext, next: Next) => {
    if (!filesInstance) filesInstance = new Files(options);
    c.set('files', filesInstance);
    await next();
  };

  const filesRoute = new Routings();
  filesRoute.use('*', filesMiddleware);
  filesRoute.errors(FILES_ERRORS);
  return filesRoute;
};

const files = createFiles();

export { files, createFiles };
