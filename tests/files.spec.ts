import { beforeAll, describe, test, expect } from 'bun:test';
import * as fs from 'fs/promises';
import { createRequire } from 'node:module';
import * as path from 'path';
import { createRoutings, testClient } from './lib';
import { middlewares } from '../src';
import type { AppContext } from '../src';

const require = createRequire(import.meta.url);
const sharp: typeof import('sharp') = require('sharp');
const uploadsFolder = path.join('/tmp', 'the-api-files-spec');

const router = createRoutings();
router.post('/upload', async (c: AppContext) => {
  const body = c.var.body as Record<string, unknown>;
  const result = await c.var.files.upload(body.file as File, 'uploads');
  c.set('result', result);
});

router.post('/upload_files', async (c: AppContext) => {
  const body = c.var.body as Record<string, unknown>;
  const files = c.var.files.getBodyFiles(body, { fields: ['files[]'] });
  const result = await c.var.files.upload(files, 'uploads');
  c.set('result', result);
});

router.post('/upload_image', async (c: AppContext) => {
  const body = c.var.body as Record<string, unknown>;
  const result = await c.var.files.upload(body.file as File, 'image-uploads');
  c.set('result', result);
});

router.post('/upload_many_images', async (c: AppContext) => {
  const body = c.var.body as Record<string, unknown>;
  const filesFromBody = c.var.files.getBodyFiles(body, {
    fields: ['file', 'file[]'],
    imagesOnly: true,
  });
  const uploads = await c.var.files.uploadMany(filesFromBody, 'image-uploads', {
    imagesOnly: true,
  });
  const uploadsFromBody = await c.var.files.uploadBody(body, 'image-uploads-body', {
    fields: ['file', 'file[]'],
    imagesOnly: true,
  });
  const firstUpload = uploads[0];
  c.set('result', {
    bodyType: c.var.bodyType,
    filesFromBody: filesFromBody.map((file) => file.name),
    imageSizes: c.var.files.getImageSizes(),
    uploads,
    uploadsFromBody,
    firstUploadVariantPath: firstUpload
      ? c.var.files.getImageVariantPath('image-uploads', firstUpload.name, 'small')
      : null,
    firstUploadDir: firstUpload
      ? c.var.files.getImageDir('image-uploads', firstUpload.name)
      : null,
  });
});

router.delete('/upload_image/:name', async (c: AppContext) => {
  const { name } = c.req.param();
  await c.var.files.deleteImage(name, 'image-uploads');
  c.set('result', { ok: true });
});

router.delete('/upload_image_body/:name', async (c: AppContext) => {
  const { name } = c.req.param();
  await c.var.files.deleteImage(name, 'image-uploads-body');
  c.set('result', { ok: true });
});

const { theAPI, client } = await testClient({
  routings: [middlewares.logs, middlewares.createFiles({ folder: uploadsFolder }), router],
  theApiOptions: { port: 7788 },
});

describe('files', () => {
  beforeAll(async () => {
    await fs.rm(uploadsFolder, { recursive: true, force: true });
  });

  test('POST /upload', async () => {
    const file = await client.readFile('./tests/static/123.txt');
    const res = await client.postFormRequest('/upload', { file });
    const json = await res?.json();
    expect(json.result.name).toEqual('123.txt');
    expect(json.result.sizes).toBeUndefined();
  });

  test('POST /upload_files', async () => {
    const file = await client.readFile('./tests/static/123.txt');
    const res = await client.postFormRequest('/upload_files', { 'files[]': file });
    const json = await res?.json();
    expect(json.result.name).toEqual('123.txt');
    expect(json.result.sizes).toBeUndefined();
  });

  test('POST /upload_image', async () => {
    const previousImageSizes = process.env.IMAGE_SIZES;
    const previousImageNameLengthBytes = process.env.IMAGE_NAME_LENGTH_BYTES;
    let uploadedPath = '';

    process.env.IMAGE_SIZES = 'small:200x150,medium:600x400,large:1200x900';
    delete process.env.IMAGE_NAME_LENGTH_BYTES;

    try {
      const imageBuffer = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 24, g: 87, b: 161 },
        },
      })
        .png()
        .toBuffer();
      const file = new File([imageBuffer], 'source.png', { type: 'image/png' });

      const res = await client.postFormRequest('/upload_image', { file });
      const json = await res?.json();
      const result = json.result as {
        fullPath: string;
        path: string;
        name: string;
        originalName: string;
        sizes: Record<string, { path: string }>;
      };

      uploadedPath = result.path;

      expect(result.name).toMatch(/^[a-f0-9]{32}$/);
      expect(result.originalName).toEqual('source.png');
      expect(result.path).toEqual(
        path.join(
          'image-uploads',
          result.name.slice(0, 2),
          result.name.slice(2, 4),
          result.name,
        ),
      );
      expect(result.fullPath).toEqual(
        path.join(
          uploadsFolder,
          'image-uploads',
          result.name.slice(0, 2),
          result.name.slice(2, 4),
          result.name,
        ),
      );
      expect(Object.keys(result.sizes)).toEqual(['small', 'medium', 'large']);

      const expectedSizes = {
        small: { width: 200, height: 150 },
        medium: { width: 600, height: 400 },
        large: { width: 1200, height: 900 },
      };

      for (const [sizeName, size] of Object.entries(expectedSizes)) {
        const variantPath = result.sizes[sizeName]?.path;
        expect(variantPath).toEqual(path.join(result.fullPath, `${sizeName}.webp`));

        const stats = await fs.stat(variantPath);
        expect(stats.isFile()).toEqual(true);

        const metadata = await sharp(variantPath).metadata();
        expect(metadata.format).toEqual('webp');
        expect(metadata.width).toEqual(size.width);
        expect(metadata.height).toEqual(size.height);
      }
    } finally {
      if (uploadedPath) {
        await fs.rm(uploadedPath, { recursive: true, force: true });
      }

      if (previousImageSizes === undefined) {
        delete process.env.IMAGE_SIZES;
      } else {
        process.env.IMAGE_SIZES = previousImageSizes;
      }

      if (previousImageNameLengthBytes === undefined) {
        delete process.env.IMAGE_NAME_LENGTH_BYTES;
      } else {
        process.env.IMAGE_NAME_LENGTH_BYTES = previousImageNameLengthBytes;
      }
    }
  });

  test('POST /upload_many_images uses body helpers and DELETE /upload_image/:name removes image set', async () => {
    const previousImageSizes = process.env.IMAGE_SIZES;

    process.env.IMAGE_SIZES = 'small:200x150,medium:600x400';

    try {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 200, g: 40, b: 40 },
        },
      })
        .png()
        .toBuffer();

      const response = await client.postFormRequest('/upload_many_images', {
        file: [
          new File([imageBuffer], 'one.png', { type: 'image/png' }),
          new File([Buffer.from('text')], 'note.txt', { type: 'text/plain' }),
        ],
        'file[]': [
          new File([imageBuffer], 'two.png', { type: 'image/png' }),
        ],
      });
      const json = await response.json();
      const result = json.result as {
        bodyType: string;
        filesFromBody: string[];
        imageSizes: Array<{ name: string }>;
        uploads: Array<{ name: string }>;
        uploadsFromBody: Array<{ name: string }>;
        firstUploadVariantPath: string;
        firstUploadDir: string;
      };

      expect(result.bodyType).toEqual('form');
      expect(result.filesFromBody).toEqual(['one.png', 'two.png']);
      expect(result.imageSizes.map(({ name }) => name)).toEqual(['small', 'medium']);
      expect(result.uploads).toHaveLength(2);
      expect(result.uploadsFromBody).toHaveLength(2);

      const firstUpload = result.uploads[0];
      const firstUploadFromBody = result.uploadsFromBody[0];
      expect(result.firstUploadDir).toEqual(
        path.join(
          uploadsFolder,
          'image-uploads',
          firstUpload.name.slice(0, 2),
          firstUpload.name.slice(2, 4),
          firstUpload.name,
        ),
      );
      expect(result.firstUploadVariantPath).toEqual(
        path.join(result.firstUploadDir, 'small.webp'),
      );

      const beforeDelete = await fs.stat(result.firstUploadVariantPath);
      expect(beforeDelete.isFile()).toEqual(true);

      const deleteResult = await client.delete(`/upload_image/${firstUpload.name}`);
      expect(deleteResult.error).toEqual(false);
      await expect(fs.stat(result.firstUploadDir)).rejects.toThrow();

      const deleteBodyResult = await client.delete(`/upload_image_body/${firstUploadFromBody.name}`);
      expect(deleteBodyResult.error).toEqual(false);
      await expect(
        fs.stat(
          path.join(
            uploadsFolder,
            'image-uploads-body',
            firstUploadFromBody.name.slice(0, 2),
            firstUploadFromBody.name.slice(2, 4),
            firstUploadFromBody.name,
          ),
        ),
      ).rejects.toThrow();
    } finally {
      if (previousImageSizes === undefined) {
        delete process.env.IMAGE_SIZES;
      } else {
        process.env.IMAGE_SIZES = previousImageSizes;
      }
    }
  });
});
