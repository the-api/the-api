import type { GetBodyFilesOptionsType, FilesImageSizeType, FilesOptions, UploadBodyOptionsType, UploadManyOptionsType, UploadResultType } from './types';
export declare class Files {
    private minioClient;
    private bucketName;
    private folder;
    private imageSizes?;
    constructor(options?: FilesOptions);
    upload(file: File | File[], destDir: string): Promise<UploadResultType>;
    delete(objectName: string): Promise<void>;
    getPresignedUrl(objectName: string, expiry?: number): Promise<string>;
    getImageSizes(): FilesImageSizeType[];
    getBodyFiles(body?: Record<string, unknown>, options?: GetBodyFilesOptionsType): File[];
    uploadMany(files: unknown[], destDir: string, options?: UploadManyOptionsType): Promise<UploadResultType[]>;
    uploadBody(body: Record<string, unknown>, destDir: string, options?: UploadBodyOptionsType): Promise<UploadResultType[]>;
    getImageDir(destDir: string, imageName: string): string;
    getImageVariantPath(destDir: string, imageName: string, sizeName: string): string;
    deleteImage(imageName: string, destDir: string): Promise<void>;
    private uploadLocal;
    private uploadMinio;
    private uploadLocalImage;
    private uploadMinioImage;
    private createImageVariants;
    private normalizeFiles;
    private isImageMimeType;
    private normalizeFile;
    private collectFiles;
    private isFile;
    private getImageRelativeDir;
    private listObjectNames;
    private validateImageSize;
    private isImageBuffer;
    private generateImageName;
}
//# sourceMappingURL=Files.d.ts.map