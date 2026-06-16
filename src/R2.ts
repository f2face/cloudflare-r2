import {
    BucketLocationConstraint,
    CreateBucketCommand,
    DeleteBucketCommand,
    ListBucketsCommand,
    S3Client,
    type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Bucket } from './Bucket.js';
import type { BucketList, BucketLocationHint, CORSPolicy, CloudflareR2Config } from './types.js';

export class R2 {
    private readonly config: Readonly<CloudflareR2Config>;
    private readonly r2: S3Client;
    public readonly endpoint: S3ClientConfig['endpoint'];

    constructor(config: CloudflareR2Config, overrides?: S3ClientConfig) {
        this.config = config;

        if (overrides?.endpoint) {
            this.endpoint = overrides.endpoint;
        } else if (this.config.jurisdiction) {
            this.endpoint = `https://${this.config.accountId}.${this.config.jurisdiction}.r2.cloudflarestorage.com`;
        } else {
            this.endpoint = `https://${this.config.accountId}.r2.cloudflarestorage.com`;
        }

        this.r2 = new S3Client({
            endpoint: this.endpoint,
            credentials: {
                accessKeyId: this.config.accessKeyId,
                secretAccessKey: this.config.secretAccessKey,
            },
            region: 'auto',
            ...overrides,
        });
    }

    /**
     * Returns the S3 client instance. Should be used as a last resort if you need extra custom functionality.
     * @note It is recommended to use other provided methods for specific operations instead of directly accessing the client.
     */
    public __unsafe_getClient(): S3Client {
        return this.r2;
    }

    /**
     * Returns a `Bucket` object that represents the specified storage bucket.
     * @param bucketName - The name of the storage bucket.
     * @returns A `Bucket` object that represents the specified storage bucket.
     */
    public bucket(bucketName: string): Bucket {
        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Returns a list of all buckets owned by the authenticated sender of the request.
     * @async
     * @returns A list of buckets with their names, creation dates, and owner info.
     */
    public async listBuckets(): Promise<BucketList> {
        const result = await this.r2.send(new ListBucketsCommand({}));
        const buckets =
            result.Buckets?.map((bucket) => {
                return {
                    name: bucket.Name,
                    creationDate: bucket.CreationDate,
                };
            }) || [];
        const owner = {
            id: result.Owner?.ID,
            displayName: result.Owner?.DisplayName,
        };
        return { buckets, owner };
    }

    /**
     * Determines if a bucket exists and you have permission to access it.
     * @async
     * @param bucketName - The name of the storage bucket.
     * @returns `true` if the bucket exists and is accessible, `false` otherwise.
     */
    public async bucketExists(bucketName: string): Promise<boolean> {
        return await this.bucket(bucketName).exists();
    }

    /**
     * Creates a new R2 bucket and returns a `Bucket` object for it.
     * @async
     * @param bucketName - The name of the bucket to create.
     * @param locationHint - Optional location hint for the bucket (e.g. `'WNAM'`, `'WEUR'`, `'APAC'`).
     * @returns A `Bucket` object representing the newly created bucket.
     */
    public async createBucket(bucketName: string, locationHint?: BucketLocationHint): Promise<Bucket> {
        await this.r2.send(
            new CreateBucketCommand({
                Bucket: bucketName,
                ...(locationHint !== undefined && {
                    CreateBucketConfiguration: {
                        LocationConstraint: locationHint as unknown as BucketLocationConstraint,
                    },
                }),
            })
        );

        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Deletes an existing bucket.
     * @async
     * @param bucketName - The name of the bucket to delete.
     * @returns `true` if the bucket was successfully deleted.
     * @throws An error if the bucket does not exist or cannot be deleted.
     */
    public async deleteBucket(bucketName: string): Promise<boolean> {
        const result = await this.r2.send(
            new DeleteBucketCommand({
                Bucket: bucketName,
            })
        );

        return result.$metadata.httpStatusCode === 204;
    }

    /**
     * Returns the Cross-Origin Resource Sharing (CORS) policies of the bucket.
     * @async
     * @param bucketName - The name of the storage bucket.
     * @returns An array of CORS policy objects.
     */
    public async getBucketCors(bucketName: string): Promise<CORSPolicy[]> {
        return await this.bucket(bucketName).getCors();
    }

    /**
     * Returns the region the bucket resides in.
     * @async
     * @param bucketName - The name of the storage bucket.
     * @returns The location constraint string (e.g. `'WNAM'`, `'WEUR'`, `'APAC'`, or `'auto'`).
     */
    public async getBucketRegion(bucketName: string): Promise<string> {
        return await this.bucket(bucketName).getRegion();
    }
}
