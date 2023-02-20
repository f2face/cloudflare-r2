import { createReadStream, PathLike } from 'fs';
import { S3 } from '@aws-sdk/client-s3';
import mime from 'mime-types';

type UploadedFile = {
    objectKey: string;
    uri: string;
    publicUrl: string | null;
    etag?: string;
    versionId?: string;
};

type HeadObjectResponse = {
    lastModified?: Date;
    contentLength?: number;
    acceptRanges?: string;
    etag?: string;
    contentType?: string;
    customMetadata?: Record<string, string>;
};

export class Bucket {
    private r2: S3;
    private endpoint: string;
    private bucketPublicUrl?: string;

    /**
     * Name of the bucket.
     */
    public readonly name: string;

    /**
     * URI of the bucket.
     */
    public readonly uri: string;

    /**
     * Instantiate `Bucket`.
     * @param r2 R2 instance.
     * @param bucketName Name of the bucket.
     * @param endpoint R2 base endpoint.
     */
    constructor(r2: S3, bucketName: string, endpoint: string) {
        this.r2 = r2;
        this.name = bucketName;
        this.endpoint = endpoint;
        this.uri = `${this.endpoint}/${this.name}`;
    }

    /**
     * Get the name of the bucket.
     */
    public getBucketName(): string {
        return this.name;
    }

    /**
     * Get the URI of the bucket.
     */
    public getUri(): string {
        return this.uri;
    }

    /**
     * If public access to the bucket is allowed, use this method to provide bucket public URL to this `Bucket` object.
     * @param bucketPublicUrl
     */
    public provideBucketPublicUrl(bucketPublicUrl: string) {
        this.bucketPublicUrl = bucketPublicUrl.endsWith('/') ? bucketPublicUrl.replace(/\/+$/, '') : bucketPublicUrl;
    }

    /**
     * Return the bucket public URL if it's set with `provideBucketPublicUrl` method.
     */
    public getPublicUrl(): string | undefined {
        return this.bucketPublicUrl;
    }

    /**
     * Generate object public URL if the bucket public URL is set with `provideBucketPublicUrl` method.
     * @param objectKey
     * @returns
     */
    protected generateObjectPublicUrl(objectKey: string) {
        if (!this.bucketPublicUrl) return null;

        return `${this.bucketPublicUrl}/${objectKey}`;
    }

    /**
     * Determine if the bucket exists and you have permission to access it.
     * @param bucketName
     */
    public async exists(): Promise<boolean> {
        try {
            const result = await this.r2.headBucket({
                Bucket: this.name,
            });

            return result.$metadata.httpStatusCode === 200;
        } catch {
            return false;
        }
    }

    /**
     * Returns the region the bucket resides in. For `Cloudflare R2`, the region is always `auto`.
     * @param bucketName
     */
    public async getRegion() {
        const result = await this.r2.getBucketLocation({
            Bucket: this.name,
        });

        return result.LocationConstraint;
    }

    public async getEncryption() {
        const result = await this.r2.getBucketEncryption({
            Bucket: this.name,
        });

        const rules =
            result.ServerSideEncryptionConfiguration?.Rules?.map((rule) => {
                return {
                    applyServerSideEncryptionByDefault: {
                        sseAlgorithm: rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm,
                        kmsMasterKeyId: rule.ApplyServerSideEncryptionByDefault?.KMSMasterKeyID,
                    },
                    bucketKeyEnabled: rule.BucketKeyEnabled,
                };
            }) || [];

        return rules;
    }

    /**
     * Upload a file to the bucket.
     * @param file File location.
     * @param destination Name of the file to put in the bucket. If `destination` contains slash character(s), this will put the file inside directories.
     * @param customMetadata Custom metadata to set to the uploaded file.
     * @returns
     */
    public async uploadFile(
        file: PathLike,
        destination: string,
        customMetadata?: Record<string, string>
    ): Promise<UploadedFile> {
        const fileStream = createReadStream(file);
        destination = destination.startsWith('/') ? destination.replace(/^\/+/, '') : destination;
        const result = await this.r2.putObject({
            Bucket: this.name,
            Key: destination,
            Body: fileStream,
            ContentType: mime.lookup(file.toString()) || 'application/octet-stream',
            Metadata: customMetadata,
        });

        return {
            objectKey: destination,
            uri: `${this.uri}/${destination}`,
            publicUrl: this.generateObjectPublicUrl(destination),
            etag: result.ETag,
            versionId: result.VersionId,
        };
    }

    /**
     * Delete a file in the bucket.
     * @param file
     */
    public async deleteFile(file: string) {
        await this.r2.deleteObject({
            Bucket: this.name,
            Key: file,
        });
    }

    /**
     * Retrieve metadata from an object without returning the object itself.
     * @param objectKey
     */
    public async headObject(objectKey: string): Promise<HeadObjectResponse> {
        const result = await this.r2.headObject({
            Bucket: this.name,
            Key: objectKey,
        });

        return {
            lastModified: result.LastModified,
            contentLength: result.ContentLength,
            acceptRanges: result.AcceptRanges,
            etag: result.ETag,
            contentType: result.ContentType,
            customMetadata: result.Metadata,
        };
    }
}
