import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetBucketCorsCommand,
    GetBucketEncryptionCommand,
    GetBucketLocationCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    ListObjectsCommand,
    PutObjectCommand,
    type S3Client as R2,
    type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Upload, type Progress } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type ReadStream, createReadStream, type PathLike } from 'fs';
import { basename } from 'path';
import type { Readable } from 'stream';
import type {
    CORSPolicy,
    HeadObjectResponse,
    ObjectListResponse,
    UploadFileResponse,
    UploadStreamOptions,
} from './types.js';

export class Bucket {
    private readonly r2: R2;
    private readonly endpoint: S3ClientConfig['endpoint'];
    private bucketPublicUrls: string[] = [];

    private _name: string;
    private _uri: string;

    /**
     * The bucket name.
     */
    public get name() {
        return this._name;
    }

    /**
     * The bucket URI (endpoint + bucket name).
     */
    public get uri() {
        return this._uri;
    }

    /**
     * Instantiate `Bucket`.
     * @param r2 R2 instance.
     * @param bucketName Name of the bucket.
     * @param endpoint Cloudflare R2 base endpoint.
     */
    constructor(r2: R2, bucketName: string, endpoint: S3ClientConfig['endpoint']) {
        this.r2 = r2;
        this._name = bucketName;
        this.endpoint = endpoint;
        this._uri = `${this.endpoint}/${this._name}`;
    }

    /**
     * Returns the name of the current bucket.
     */
    public getBucketName(): string {
        return this._name;
    }

    /**
     * Returns the URI for the current bucket.
     */
    public getUri(): string {
        return this._uri;
    }

    public provideBucketPublicUrl(bucketPublicUrl: string): this;
    public provideBucketPublicUrl(bucketPublicUrls: string[]): this;

    /**
     * Sets the public URL for the current bucket. If public access to the bucket is allowed, use this method to provide bucket public URL to this `Bucket` object.
     * @param bucketPublicUrl The public URL of the current bucket.
     * @note If public access to the bucket is not allowed, the public URL set by this method will not be accessible to the public. Invoking this function will not have any effect on the security or access permissions of the bucket.
     */
    public provideBucketPublicUrl(bucketPublicUrl: string | string[]): this {
        if (typeof bucketPublicUrl === 'string') {
            const origin = new URL(bucketPublicUrl).origin;
            if (!this.bucketPublicUrls.includes(origin)) this.bucketPublicUrls.push(origin);
        } else if (Array.isArray(bucketPublicUrl)) {
            for (const url of bucketPublicUrl) {
                this.provideBucketPublicUrl(url);
            }
        }

        return this;
    }

    /**
     * **DEPRECATED. This method will be removed in the next major version. Use `getPublicUrls()` instead.**
     *
     * Returns the bucket public URL if it's set with `provideBucketPublicUrl` method.
     * @deprecated
     */
    public getPublicUrl(): string | undefined {
        return this.bucketPublicUrls.length ? this.bucketPublicUrls.at(0) : undefined;
    }

    /**
     * Returns all public URLs of the bucket if it's set with `provideBucketPublicUrl()` method.
     */
    public getPublicUrls(): string[] {
        return this.bucketPublicUrls;
    }

    /**
     * Generates a pre-signed URL for downloading an object via GET.
     * This method does not check whether the object exists.
     * @async
     * @param objectKey - The key of the object.
     * @param expiresIn - Expiration time in seconds.
     * @returns The pre-signed URL.
     */
    public async getObjectSignedUrl(objectKey: string, expiresIn: number): Promise<string> {
        const obj = new GetObjectCommand({
            Bucket: this._name,
            Key: objectKey,
        });
        return getSignedUrl(this.r2, obj, { expiresIn });
    }

    /**
     * Generates a pre-signed URL for uploading an object via PUT.
     * @async
     * @param objectKey - The key of the object.
     * @param expiresIn - Expiration time in seconds.
     * @returns The pre-signed URL.
     */
    public async putObjectSignedUrl(objectKey: string, expiresIn: number): Promise<string> {
        const obj = new PutObjectCommand({
            Bucket: this._name,
            Key: objectKey,
        });
        return getSignedUrl(this.r2, obj, { expiresIn });
    }

    /**
     * Generates the public URL for an object using the first configured bucket public URL.
     * @param objectKey The key of the object.
     * @returns The public URL, or `null` if no bucket public URL is configured.
     */
    protected generateObjectPublicUrl(objectKey: string): string | null {
        if (!this.bucketPublicUrls.length) return null;

        return `${this.bucketPublicUrls.at(0)}/${objectKey}`;
    }

    /**
     * Generates public URLs for an object from all configured bucket public URLs.
     * @param objectKey The key of the object.
     * @returns An array of public URLs, or an empty array if no bucket public URL is configured.
     */
    protected generateObjectPublicUrls(objectKey: string): Array<string> {
        if (!this.bucketPublicUrls.length) return [];

        return this.bucketPublicUrls.map((publicUrl) => `${publicUrl}/${objectKey}`);
    }

    /**
     * Returns all public URLs for an object in the bucket.
     * @param objectKey The key of the object.
     * @returns An array of public URLs.
     */
    public getObjectPublicUrls(objectKey: string): string[] {
        return this.bucketPublicUrls.map((bucketPublicUrl) => `${bucketPublicUrl}/${objectKey}`);
    }

    /**
     * Checks if the bucket exists and you have permission to access it.
     * @async
     * @returns `true` if the bucket exists and is accessible, `false` otherwise.
     */
    public async exists(): Promise<boolean> {
        try {
            const result = await this.r2.send(
                new HeadBucketCommand({
                    Bucket: this._name,
                })
            );

            return result.$metadata.httpStatusCode === 200;
        } catch {
            return false;
        }
    }

    /**
     * **DEPRECATED. This method will be removed in the next major version. Use `getCorsPolicies()` instead.**
     *
     * @async
     * @deprecated
     * @returns Cross-Origin Resource Sharing (CORS) policies of the bucket.
     */
    public async getCors(): Promise<CORSPolicy[]> {
        return this.getCorsPolicies();
    }

    /**
     * Returns the Cross-Origin Resource Sharing (CORS) policies of the bucket.
     * @async
     * @returns An array of CORS policy objects.
     */
    public async getCorsPolicies(): Promise<CORSPolicy[]> {
        try {
            const result = await this.r2.send(
                new GetBucketCorsCommand({
                    Bucket: this._name,
                })
            );

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
     * Returns the bucket's location constraint. For Cloudflare R2 this is the bucket's
     * location hint (e.g. `'WNAM'`, `'WEUR'`, `'APAC'`) if one was set, otherwise `'auto'`.
     * @async
     * @returns The location constraint string.
     */
    public async getRegion(): Promise<string> {
        const result = await this.r2.send(
            new GetBucketLocationCommand({
                Bucket: this._name,
            })
        );
        return result.LocationConstraint || 'auto';
    }

    /**
     * Returns the server-side encryption configuration of the bucket.
     * @async
     * @returns An array of encryption rules.
     */
    public async getEncryption() {
        const result = await this.r2.send(
            new GetBucketEncryptionCommand({
                Bucket: this._name,
            })
        );

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
     * Upload a local file to the bucket. If the file already exists, it will be overwritten.
     * @async
     * @param file - Path to the local file.
     * @param destination - Name to give the file in the bucket. Supports directory-like prefixes via slashes. Defaults to the file's basename.
     * @param customMetadata - Custom metadata to attach to the object.
     * @param mimeType - MIME type. (Default: `application/octet-stream`)
     * @returns An {@link UploadFileResponse}.
     */
    public async uploadFile(
        file: PathLike,
        destination?: string,
        customMetadata?: Record<string, string>,
        mimeType?: string
    ): Promise<UploadFileResponse> {
        const fileStream = createReadStream(file);
        try {
            const result = await this.upload(
                fileStream,
                destination || basename(file.toString()),
                customMetadata,
                mimeType
            );
            fileStream.close();
            return result;
        } catch (error) {
            fileStream.close();
            throw error;
        }
    }

    /**
     * Upload an object to the bucket. If the file already exists, it will be overwritten.
     * @async
     * @param contents - The data to upload. Accepts `string`, `Buffer`, `Uint8Array`, or a `Readable` stream.
     * @param destination - The object key in the bucket. Supports directory-like prefixes via slashes.
     * @param customMetadata - Custom metadata to attach to the object.
     * @param mimeType - MIME type. (Default: `application/octet-stream`)
     * @returns An {@link UploadFileResponse}.
     */
    public async upload(
        contents: string | Uint8Array | Buffer | Readable | ReadStream,
        destination: string,
        customMetadata?: Record<string, string>,
        mimeType?: string
    ): Promise<UploadFileResponse> {
        destination = destination.startsWith('/') ? destination.replace(/^\/+/, '') : destination;

        const result = await this.r2.send(
            new PutObjectCommand({
                Bucket: this._name,
                Key: destination,
                Body: contents,
                ContentType: mimeType || 'application/octet-stream',
                Metadata: customMetadata,
            })
        );

        return {
            objectKey: destination,
            uri: `${this._uri}/${destination}`,
            publicUrl: this.generateObjectPublicUrl(destination),
            publicUrls: this.generateObjectPublicUrls(destination),
            etag: result.ETag,
            versionId: result.VersionId,
        };
    }

    /**
     * Upload an object or stream to the bucket using multipart upload. Best for large files.
     * If the file already exists, it will be overwritten.
     * @async
     * @param contents - The data to upload. Accepts `string`, `Buffer`, `Uint8Array`, or a `Readable` stream.
     * @param destination - The object key in the bucket. Supports directory-like prefixes via slashes.
     * @param customMetadata - Custom metadata to attach to the object.
     * @param mimeType - MIME type. (Default: `application/octet-stream`)
     * @param onProgress - A callback to receive upload progress updates.
     * @param options - Additional multipart upload options.
     * @param options.partSize - Size of each part in bytes. Increase this to avoid the 10,000 part limit for very large files. (Default: 5 MB)
     * @param options.queueSize - Number of parts to upload concurrently. (Default: 4)
     * @returns An {@link UploadFileResponse}.
     */
    public async uploadStream(
        contents: string | Uint8Array | Buffer | Readable | ReadStream,
        destination: string,
        customMetadata?: Record<string, string>,
        mimeType?: string,
        onProgress?: (progress: Progress) => void,
        options?: UploadStreamOptions
    ): Promise<UploadFileResponse> {
        destination = destination.startsWith('/') ? destination.replace(/^\/+/, '') : destination;

        const upload = new Upload({
            client: this.r2,
            params: {
                Bucket: this._name,
                Key: destination,
                Body: contents,
                ContentType: mimeType || 'application/octet-stream',
                Metadata: customMetadata,
            },
            ...(options?.partSize !== undefined && { partSize: options.partSize }),
            ...(options?.queueSize !== undefined && { queueSize: options.queueSize }),
        });

        if (onProgress) upload.on('httpUploadProgress', (progress) => onProgress(progress));

        const result = await upload.done();

        return {
            objectKey: destination,
            uri: `${this._uri}/${destination}`,
            publicUrl: this.generateObjectPublicUrl(destination),
            publicUrls: this.generateObjectPublicUrls(destination),
            etag: result.ETag,
            versionId: result.VersionId,
        };
    }

    /**
     * **DEPRECATED. This method will be removed in the next major version. Use `deleteObject()` instead.**
     *
     * @async
     * @deprecated
     * @param file - The key of the file to delete.
     * @returns `true` if deletion succeeded (2xx status), `false` otherwise.
     */
    public async deleteFile(file: string) {
        return this.deleteObject(file);
    }

    /**
     * Deletes an object from the bucket.
     * @async
     * @param objectKey - The key of the object to delete.
     * @returns `true` if deletion succeeded (2xx status), `false` otherwise.
     */
    public async deleteObject(objectKey: string) {
        const result = await this.r2.send(
            new DeleteObjectCommand({
                Bucket: this._name,
                Key: objectKey,
            })
        );

        return (
            result.$metadata.httpStatusCode &&
            result.$metadata.httpStatusCode >= 200 &&
            result.$metadata.httpStatusCode < 300
        );
    }

    /**
     * Retrieves metadata for an object without downloading it.
     * @async
     * @param objectKey - The key of the object.
     * @returns The object's metadata.
     */
    public async headObject(objectKey: string): Promise<HeadObjectResponse> {
        const result = await this.r2.send(
            new HeadObjectCommand({
                Bucket: this._name,
                Key: objectKey,
            })
        );

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
     * Use `nextContinuationToken` from the response for pagination.
     * @async
     * @param maxResults - The maximum number of objects to return per request. (Default: 1000)
     * @param marker - A token that specifies where to start the listing.
     * @returns An {@link ObjectListResponse}.
     */
    public async listObjects(maxResults = 1000, marker?: string): Promise<ObjectListResponse> {
        const result = await this.r2.send(
            new ListObjectsCommand({
                Bucket: this._name,
                MaxKeys: maxResults,
                Marker: marker,
            })
        );

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
            continuationToken: result.Marker,
            nextContinuationToken: result.NextMarker,
        };
    }

    /**
     * Copies an object within the same bucket.
     * @async
     * @param sourceObjectKey - The key of the source object.
     * @param destinationObjectKey - The key of the destination object.
     * @returns The copy result from the S3 API.
     */
    public async copyObject(sourceObjectKey: string, destinationObjectKey: string) {
        const copySource = `${this._name}/${sourceObjectKey}`;
        const result = await this.r2.send(
            new CopyObjectCommand({
                Bucket: this._name,
                CopySource: copySource,
                Key: destinationObjectKey,
            })
        );

        return result;
    }

    /**
     * Checks if an object exists in the bucket.
     * @async
     * @param objectKey - The key of the object.
     * @returns `true` if the object exists and has content, `false` otherwise.
     */
    public async objectExists(objectKey: string): Promise<boolean> {
        try {
            const result = await this.headObject(objectKey);

            return result.contentLength ? true : false;
        } catch {
            return false;
        }
    }
}
