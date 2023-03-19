import { S3 } from '@aws-sdk/client-s3';
import { Bucket } from './Bucket';
import { CORSPolicy } from './types';

type Config = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
};

type BucketList = {
    buckets: {
        name?: string;
        creationDate?: Date;
    }[];
    owner: {
        id?: string;
        displayName?: string;
    };
};

export class R2 {
    private config: Config;
    private r2: S3;
    public endpoint: string;

    constructor(config: Config) {
        this.config = config;
        this.endpoint = `https://${this.config.accountId}.r2.cloudflarestorage.com`;

        this.r2 = new S3({
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
        const result = await this.r2.listBuckets({});
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
        await this.r2.createBucket({
            Bucket: bucketName,
        });

        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Delete an existing bucket. Returns true if success or throws error if fail.
     * @async
     * @param bucketName
     */
    public async deleteBucket(bucketName: string): Promise<boolean> {
        const result = await this.r2.deleteBucket({
            Bucket: bucketName,
        });

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
