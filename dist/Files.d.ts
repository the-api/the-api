import type { FilesOptions, UploadResultType } from './types';
export declare class Files {
    private minioClient;
    private bucketName;
    private folder;
    constructor(options?: FilesOptions);
    upload(file: File, destDir: string): Promise<UploadResultType>;
    delete(objectName: string): Promise<void>;
    getPresignedUrl(objectName: string, expiry?: number): Promise<string>;
    private uploadLocal;
    private uploadMinio;
}
//# sourceMappingURL=Files.d.ts.map