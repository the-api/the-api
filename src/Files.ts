import * as fs from 'fs/promises';
import * as path from 'path';
import * as Minio from 'minio';
import type { FilesOptions, UploadResultType } from './types';

export class Files {
  private minioClient: Minio.Client | null;
  private bucketName: string;
  private folder: string;

  constructor(options?: FilesOptions) {
    const { folder, minio } = options || {};
    const {
      FILES_FOLDER,
      MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY,
      MINIO_BUCKET_NAME,
      MINIO_ENDPOINT = 'localhost',
      MINIO_PORT = '9000',
      MINIO_USE_SSL = 'true',
    } = process.env;

    this.folder = FILES_FOLDER || folder || '';
    this.bucketName = MINIO_BUCKET_NAME || minio?.bucketName || '';

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

  async upload(file: File, destDir: string): Promise<UploadResultType> {
    if (this.folder) {
      return this.uploadLocal(file, destDir);
    }

    if (this.minioClient) {
      return this.uploadMinio(file, destDir);
    }

    throw new Error('FILES_NO_STORAGE_CONFIGURED');
  }

  async delete(objectName: string): Promise<void> {
    if (this.folder) {
      const fullPath = path.join(this.folder, objectName);
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

  // -- private --

  private async uploadLocal(
    file: File,
    destDir: string,
  ): Promise<UploadResultType> {
    const fullDir = path.join(this.folder, destDir);
    await fs.mkdir(fullDir, { recursive: true });

    const destPath = path.join(fullDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destPath, buffer);

    return { path: destPath, name: file.name, size: file.size };
  }

  private async uploadMinio(
    file: File,
    destDir: string,
  ): Promise<UploadResultType> {
    const objectName = path.posix.join(destDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

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
}
