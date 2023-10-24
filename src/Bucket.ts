import { S3 as R2 } from '@aws-sdk/client-s3';
import { createReadStream, PathLike } from 'fs';
import { CORSPolicy, HeadObjectResponse, ObjectListResponse, UploadFileResponse } from './types';

export class Bucket {
    private r2: R2;
    private endpoint: string;
    private bucketPublicUrl?: string;

    /**
     * Name of the bucket.
     * @readonly
     */
    public readonly name: string;

    /**
     * URI of the bucket.
     * @readonly
     */
    public readonly uri: string;

    /**
     * Instantiate `Bucket`.
     * @param r2 R2 instance.
     * @param bucketName Name of the bucket.
     * @param endpoint Cloudflare R2 base endpoint.
     */
    constructor(r2: R2, bucketName: string, endpoint: string) {
        this.r2 = r2;
        this.name = bucketName;
        this.endpoint = new URL(endpoint).origin;
        this.uri = `${this.endpoint}/${this.name}`;
    }

    /**
     * Returns the name of the current bucket.
     */
    public getBucketName(): string {
        return this.name;
    }

    /**
     * Returns the URI for the current bucket.
     */
    public getUri(): string {
        return this.uri;
    }

    /**
     * Sets the public URL for the current bucket. If public access to the bucket is allowed, use this method to provide bucket public URL to this `Bucket` object.
     * @param bucketPublicUrl The public URL of the current bucket.
     * @note If public access to the bucket is not allowed, the public URL set by this method will not be accessible to the public. Invoking this function will not have any effect on the security or access permissions of the bucket.
     */
    public provideBucketPublicUrl(bucketPublicUrl: string) {
        this.bucketPublicUrl = new URL(bucketPublicUrl).origin;
    }

    /**
     * Returns the bucket public URL if it's set with `provideBucketPublicUrl` method.
     */
    public getPublicUrl(): string | undefined {
        return this.bucketPublicUrl;
    }

    /**
     * Generates object public URL if the bucket public URL is set with `provideBucketPublicUrl` method.
     * @param objectKey
     * @returns
     */
    protected generateObjectPublicUrl(objectKey: string): string | null {
        if (!this.bucketPublicUrl) return null;

        return `${this.bucketPublicUrl}/${objectKey}`;
    }

    /**
     * Determines if the bucket exists and you have permission to access it.
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
     * Returns Cross-Origin Resource Sharing (CORS) policies of the bucket.
     */
    public async getCors(): Promise<CORSPolicy[]> {
        try {
            const result = await this.r2.getBucketCors({
                Bucket: this.name,
            });

            const corsPolicies =
                result.CORSRules?.map((rule) => {
                    const {
                        AllowedHeaders: allowedHeaders,
                        AllowedMethods: allowedMethods,
                        AllowedOrigins: allowedOrigins,
                        ExposeHeaders: exposeHeaders,
                        ID: id,
                        MaxAgeSeconds: maxAgeSeconds,
                    } = rule;
                    return {
                        allowedHeaders,
                        allowedMethods,
                        allowedOrigins,
                        exposeHeaders,
                        id,
                        maxAgeSeconds,
                    };
                }) || [];

            return corsPolicies;
        } catch {
            return [];
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

        return result.LocationConstraint || 'auto';
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
     * @param mimeType Optional mime type. (Default: `application/octet-stream`)
     */
    public async uploadFile(
        file: PathLike,
        destination: string,
        customMetadata?: Record<string, string>,
        mimeType?: string
    ): Promise<UploadFileResponse> {
        const fileStream = createReadStream(file);
        try {
            destination = destination.startsWith('/') ? destination.replace(/^\/+/, '') : destination;
            const result = await this.r2.putObject({
                Bucket: this.name,
                Key: destination,
                Body: fileStream,
                ContentType: mimeType || 'application/octet-stream',
                Metadata: customMetadata,
            });

            fileStream.close();

            return {
                objectKey: destination,
                uri: `${this.uri}/${destination}`,
                publicUrl: this.generateObjectPublicUrl(destination),
                etag: result.ETag,
                versionId: result.VersionId,
            };
        } catch (error) {
            fileStream.close();
            throw error;
        }
    }

    /**
     * Deletes a file in the bucket.
     * @param file
     */
    public async deleteFile(file: string) {
        const result = await this.r2.deleteObject({
            Bucket: this.name,
            Key: file,
        });

        return result.$metadata.httpStatusCode === 200;
    }

    /**
     * Retrieves metadata from an object without returning the object itself.
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

    /**
     * Returns some or all (up to 1,000) of the objects in the bucket with each request.
     * @param maxResults The maximum number of objects to return per request. (Default: 1000)
     * @param continuationToken A token that specifies where to start the listing.
     */
    public async listObjects(maxResults = 1000, continuationToken?: string): Promise<ObjectListResponse> {
        const result = await this.r2.listObjectsV2({
            Bucket: this.name,
            MaxKeys: maxResults,
            ContinuationToken: continuationToken,
        });

        return {
            objects:
                result.Contents?.map((content) => {
                    const {
                        Key: key,
                        LastModified: lastModified,
                        ETag: etag,
                        ChecksumAlgorithm: checksumAlgorithm,
                        Size: size,
                        StorageClass: storageClass,
                    } = content;
                    return {
                        key,
                        lastModified,
                        etag,
                        checksumAlgorithm,
                        size,
                        storageClass,
                    };
                }) || [],
            continuationToken: result.ContinuationToken,
            nextContinuationToken: result.NextContinuationToken,
        };
    }

    /**
     * Copies an object from the current storage bucket to a new destination object in the same bucket.
     * @param source The key of the source object to be copied.
     * @param destination The key of the destination object where the source object will be copied to.
     */
    public async copyObject(source: string, destination: string) {
        const result = await this.r2.copyObject({
            Bucket: this.name,
            CopySource: source,
            Key: destination,
        });

        return result;
    }

    public async objectExists(objectkey: string): Promise<boolean> {
        try {
            const result = await this.headObject(objectkey);

            return result.contentLength ? true : false;
        } catch {
            return false;
        }
    }
}
