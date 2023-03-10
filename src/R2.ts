import { S3 } from '@aws-sdk/client-s3';
import { Bucket } from './Bucket';

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

    bucket(bucketName: string): Bucket {
        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Returns a list of all buckets owned by the authenticated sender of the request.
     */
    async listBuckets(): Promise<BucketList> {
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
     * Determine if a bucket exists and you have permission to access it.
     * @param bucketName
     */
    async bucketExists(bucketName: string): Promise<boolean> {
        try {
            const result = await this.r2.headBucket({
                Bucket: bucketName,
            });

            return result.$metadata.httpStatusCode === 200;
        } catch {
            return false;
        }
    }

    /**
     * Create a new R2 bucket.
     * @param bucketName
     */
    async createBucket(bucketName: string): Promise<Bucket> {
        await this.r2.createBucket({
            Bucket: bucketName,
        });

        return new Bucket(this.r2, bucketName, this.endpoint);
    }

    /**
     * Delete an existing bucket.
     * @param bucketName
     */
    async deleteBucket(bucketName: string): Promise<void> {
        await this.r2.deleteBucket({
            Bucket: bucketName,
        });
    }

    /**
     * Returns the region the bucket resides in. For `Cloudflare R2`, the region is always `auto`.
     * @param bucketName
     */
    async getBucketRegion(bucketName: string) {
        const result = await this.r2.getBucketLocation({
            Bucket: bucketName,
        });

        return result.LocationConstraint;
    }
}
