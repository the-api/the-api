import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Minio from 'minio';
import type {
  GetBodyFilesOptionsType,
  FilesImageSizeType,
  FilesOptions,
  UploadBodyOptionsType,
  UploadImageSizeResultType,
  UploadManyOptionsType,
  UploadResultType,
} from './types';

const require = createRequire(import.meta.url);
const sharp: typeof import('sharp') = require('sharp');

export class Files {
  private minioClient: Minio.Client | null;
  private bucketName: string;
  private folder: string;
  private imageSizes?: FilesOptions['imageSizes'];
  private imageNameLengthBytes: number;

  constructor(options?: FilesOptions) {
    const { folder, minio, imageSizes } = options || {};
    const {
      FILES_FOLDER,
      MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY,
      MINIO_BUCKET_NAME,
      MINIO_ENDPOINT = 'localhost',
      MINIO_PORT = '9000',
      MINIO_USE_SSL = 'true',
      IMAGE_NAME_LENGTH_BYTES,
    } = process.env;

    this.folder = folder || FILES_FOLDER || '';
    this.bucketName = minio?.bucketName || MINIO_BUCKET_NAME || '';
    this.imageSizes = imageSizes;
    this.imageNameLengthBytes = Number(IMAGE_NAME_LENGTH_BYTES) || 16;

    this.minioClient =
      this.bucketName && MINIO_ACCESS_KEY && MINIO_SECRET_KEY
        ? new Minio.Client({
            endPoint: minio?.endPoint || MINIO_ENDPOINT,
            port: minio?.port || parseInt(MINIO_PORT, 10),
            useSSL:
              minio?.useSSL !== undefined
                ? minio.useSSL
                : MINIO_USE_SSL === 'true',
            accessKey: minio?.accessKey || MINIO_ACCESS_KEY,
            secretKey: minio?.secretKey || MINIO_SECRET_KEY,
          })
        : null;
  }

  async upload(file: File | File[], destDir: string): Promise<UploadResultType> {
    const normalizedFile = this.normalizeFile(file);
    const buffer = Buffer.from(await normalizedFile.arrayBuffer());
    const imageSizes = this.getImageSizes();

    if (imageSizes.length) {
      const isImage = await this.isImageBuffer(buffer);

      if (isImage) {
        if (this.folder) {
          return this.uploadLocalImage(normalizedFile, buffer, destDir, imageSizes);
        }

        if (this.minioClient) {
          return this.uploadMinioImage(normalizedFile, buffer, destDir, imageSizes);
        }
      }
    }

    if (this.folder) {
      return this.uploadLocal(normalizedFile, buffer, destDir);
    }

    if (this.minioClient) {
      return this.uploadMinio(normalizedFile, buffer, destDir);
    }

    throw new Error('FILES_NO_STORAGE_CONFIGURED');
  }

  async delete(objectName: string): Promise<void> {
    if (this.folder) {
      const fullPath = path.isAbsolute(objectName)
        ? objectName
        : path.join(this.folder, objectName);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
        return;
      }

      await fs.unlink(fullPath);
      return;
    }

    if (this.minioClient) {
      await this.minioClient.removeObject(this.bucketName, objectName);
      return;
    }

    throw new Error('FILES_NO_STORAGE_CONFIGURED');
  }

  async getPresignedUrl(
    objectName: string,
    expiry = 7 * 24 * 60 * 60,
  ): Promise<string> {
    if (!this.minioClient) {
      throw new Error('FILES_NO_MINIO_CONFIGURED');
    }
    return this.minioClient.presignedGetObject(
      this.bucketName,
      objectName,
      expiry,
    );
  }

  getImageSizes(): FilesImageSizeType[] {
    const imageSizes = this.imageSizes ?? process.env.IMAGE_SIZES;

    if (!imageSizes) {
      return [];
    }

    if (Array.isArray(imageSizes)) {
      return imageSizes.map((config) => this.validateImageSize(config));
    }

    return imageSizes
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const match = item.match(
          /^(?<name>[a-zA-Z0-9_-]+):(?<width>\d+)x(?<height>\d+)$/,
        );

        if (!match?.groups) {
          throw new Error('FILES_INVALID_IMAGE_SIZES_CONFIG');
        }

        return this.validateImageSize({
          name: match.groups.name,
          width: Number(match.groups.width),
          height: Number(match.groups.height),
        });
      });
  }

  getBodyFiles(
    body: Record<string, unknown> = {},
    options: GetBodyFilesOptionsType = {},
  ): File[] {
    const { fields = ['file', 'file[]'], imagesOnly = false } = options;
    const files = fields
      .flatMap((field) => this.collectFiles(body[field]));

    if (!imagesOnly) {
      return files;
    }

    return files.filter((file) => this.isImageMimeType(file));
  }

  async uploadMany(
    files: unknown[],
    destDir: string,
    options: UploadManyOptionsType = {},
  ): Promise<UploadResultType[]> {
    const normalizedFiles = this.normalizeFiles(files, options.imagesOnly);
    return Promise.all(normalizedFiles.map((file) => this.upload(file, destDir)));
  }

  async uploadBody(
    body: Record<string, unknown>,
    destDir: string,
    options: UploadBodyOptionsType = {},
  ): Promise<UploadResultType[]> {
    return this.uploadMany(
      this.getBodyFiles(body, options),
      destDir,
      { imagesOnly: false },
    );
  }

  getImageDir(destDir: string, imageName: string): string {
    const relativeDir = this.getImageRelativeDir(destDir, imageName);

    if (this.folder) {
      return path.join(this.folder, relativeDir);
    }

    return relativeDir;
  }

  getImageVariantPath(
    destDir: string,
    imageName: string,
    sizeName: string,
  ): string {
    const imageDir = this.getImageDir(destDir, imageName);

    if (this.folder) {
      return path.join(imageDir, `${sizeName}.webp`);
    }

    return path.posix.join(imageDir, `${sizeName}.webp`);
  }

  async deleteImage(imageName: string, destDir: string): Promise<void> {
    if (this.folder) {
      await this.delete(this.getImageDir(destDir, imageName));
      return;
    }

    if (this.minioClient) {
      const objectPrefix = this.getImageDir(destDir, imageName);
      const objectNames = await this.listObjectNames(objectPrefix);

      await Promise.all(
        objectNames.map((objectName) =>
          this.minioClient!.removeObject(this.bucketName, objectName)),
      );
      return;
    }

    throw new Error('FILES_NO_STORAGE_CONFIGURED');
  }

  // -- private --

  private async uploadLocal(
    file: File,
    buffer: Buffer,
    destDir: string,
  ): Promise<UploadResultType> {
    const fullDir = path.join(this.folder, destDir);
    await fs.mkdir(fullDir, { recursive: true });

    const destPath = path.join(fullDir, file.name);
    await fs.writeFile(destPath, buffer);

    return { path: destPath, name: file.name, size: file.size };
  }

  private async uploadMinio(
    file: File,
    buffer: Buffer,
    destDir: string,
  ): Promise<UploadResultType> {
    const objectName = path.posix.join(destDir, file.name);

    await this.minioClient!.putObject(
      this.bucketName,
      objectName,
      buffer,
      file.size,
      { 'Content-Type': file.type || 'application/octet-stream' },
    );

    return {
      path: objectName,
      name: file.name,
      size: file.size,
      bucket: this.bucketName,
    };
  }

  private async uploadLocalImage(
    file: File,
    buffer: Buffer,
    destDir: string,
    imageSizes: FilesImageSizeType[],
  ): Promise<UploadResultType> {
    const imageName = this.generateImageName();
    const relativeDir = path.join(
      destDir,
      imageName.slice(0, 2),
      imageName.slice(2, 4),
      imageName,
    );
    const fullDir = path.join(this.folder, relativeDir);
    await fs.mkdir(fullDir, { recursive: true });

    const sizes = await this.createImageVariants(buffer, imageSizes, async (
      config,
      resizedBuffer,
      info,
    ) => {
      const destPath = path.join(fullDir, `${config.name}.webp`);
      await fs.writeFile(destPath, resizedBuffer);

      return {
        path: destPath,
        width: info.width,
        height: info.height,
        size: info.size,
      };
    });

    return {
      path: relativeDir,
      name: imageName,
      size: file.size,
      originalName: file.name,
      sizes,
    };
  }

  private async uploadMinioImage(
    file: File,
    buffer: Buffer,
    destDir: string,
    imageSizes: FilesImageSizeType[],
  ): Promise<UploadResultType> {
    const imageName = this.generateImageName();
    const objectDir = path.posix.join(
      destDir,
      imageName.slice(0, 2),
      imageName.slice(2, 4),
      imageName,
    );

    const sizes = await this.createImageVariants(buffer, imageSizes, async (
      config,
      resizedBuffer,
      info,
    ) => {
      const objectName = path.posix.join(objectDir, `${config.name}.webp`);

      await this.minioClient!.putObject(
        this.bucketName,
        objectName,
        resizedBuffer,
        resizedBuffer.byteLength,
        { 'Content-Type': 'image/webp' },
      );

      return {
        path: objectName,
        width: info.width,
        height: info.height,
        size: info.size,
      };
    });

    return {
      path: objectDir,
      name: imageName,
      size: file.size,
      bucket: this.bucketName,
      originalName: file.name,
      sizes,
    };
  }

  private async createImageVariants(
    buffer: Buffer,
    imageSizes: FilesImageSizeType[],
    save: (
      config: FilesImageSizeType,
      resizedBuffer: Buffer,
      info: { width: number; height: number; size: number },
    ) => Promise<UploadImageSizeResultType>,
  ): Promise<Record<string, UploadImageSizeResultType>> {
    const variants = await Promise.all(
      imageSizes.map(async (config) => {
        const { data, info } = await sharp(buffer)
          .rotate()
          .resize({
            width: config.width,
            height: config.height,
            fit: 'cover',
          })
          .webp()
          .toBuffer({ resolveWithObject: true });

        return [
          config.name,
          await save(config, data, {
            width: info.width,
            height: info.height,
            size: info.size,
          }),
        ] as const;
      }),
    );

    return Object.fromEntries(variants);
  }

  private normalizeFiles(files: unknown[], imagesOnly = false): File[] {
    const normalizedFiles = this.collectFiles(files);

    if (!imagesOnly) {
      return normalizedFiles;
    }

    return normalizedFiles.filter((file) => this.isImageMimeType(file));
  }

  private isImageMimeType(file: File): boolean {
    return /^image\//.test(file.type || '');
  }

  private normalizeFile(value: unknown): File {
    const [file] = this.collectFiles(value);

    if (!file) {
      throw new Error('FILES_INVALID_FILE');
    }

    return file;
  }

  private collectFiles(value: unknown): File[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectFiles(item));
    }

    if (this.isFile(value)) {
      return [value];
    }

    return [];
  }

  private isFile(value: unknown): value is File {
    if (!value || typeof value !== 'object') {
      return false;
    }

    return (
      typeof (value as File).arrayBuffer === 'function'
      && typeof (value as File).name === 'string'
    );
  }

  private getImageRelativeDir(destDir: string, imageName: string): string {
    return path.posix.join(
      destDir.replace(/\\/g, '/'),
      imageName.slice(0, 2),
      imageName.slice(2, 4),
      imageName,
    );
  }

  private async listObjectNames(prefix: string): Promise<string[]> {
    if (!this.minioClient) {
      return [];
    }

    const stream = this.minioClient.listObjectsV2(
      this.bucketName,
      prefix,
      true,
    );

    return new Promise((resolve, reject) => {
      const objectNames: string[] = [];

      stream.on('data', (item) => {
        if (item.name) objectNames.push(item.name);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(objectNames));
    });
  }

  private validateImageSize(config: FilesImageSizeType): FilesImageSizeType {
    if (
      !config.name
      || !Number.isInteger(config.width)
      || !Number.isInteger(config.height)
      || config.width <= 0
      || config.height <= 0
    ) {
      throw new Error('FILES_INVALID_IMAGE_SIZES_CONFIG');
    }

    return config;
  }

  private async isImageBuffer(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!metadata.width && !!metadata.height;
    } catch {
      return false;
    }
  }

  private generateImageName(): string {
    return randomBytes(this.imageNameLengthBytes).toString('hex');
  }
}
