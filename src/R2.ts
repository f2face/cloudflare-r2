import { CreateBucketCommand, DeleteBucketCommand, ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';
import { Bucket } from './Bucket';
import type { BucketList, CORSPolicy, CloudflareR2Config } from './types';

export class R2 {
    private config: CloudflareR2Config;
    private r2: S3Client;
    public endpoint: string;

    constructor(config: CloudflareR2Config) {
        this.config = config;

        if (this.config.jurisdiction) {
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
        });
    }

    /**
     * Returns a `Bucket` object that represents the specified storage bucket.
     * @param bucketName The name of the storage bucket.
     * @returns A `Bucket` object that represents the specified storage bucket.
     */
    public bucket(bucketName: string): Bucket {
        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Returns a list of all buckets owned by the authenticated sender of the request.
     * @async
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
     * @param bucketName
     */
    public async bucketExists(bucketName: string): Promise<boolean> {
        return await this.bucket(bucketName).exists();
    }

    /**
     * Create a new R2 bucket and returns `Bucket` object.
     * @async
     * @param bucketName
     */
    public async createBucket(bucketName: string): Promise<Bucket> {
        await this.r2.send(
            new CreateBucketCommand({
                Bucket: bucketName,
            })
        );

        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Delete an existing bucket. Returns true if success or throws error if fail.
     * @async
     * @param bucketName
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
     * Returns Cross-Origin Resource Sharing (CORS) policies of the bucket.
     * @async
     */
    public async getBucketCors(bucketName: string): Promise<CORSPolicy[]> {
        return await this.bucket(bucketName).getCors();
    }

    /**
     * Returns the region the bucket resides in. For `Cloudflare R2`, the region is always `auto`.
     * @async
     * @param bucketName
     */
    public async getBucketRegion(bucketName: string): Promise<string> {
        return await this.bucket(bucketName).getRegion();
    }
}
