export type CloudflareR2Config = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    /**
     * If set, the endpoint will be `https://{accountId}.{jurisdiction}.r2.cloudflarestorage.com`.
     */
    jurisdiction?: 'eu' | 'fedramp';
};

export type BucketList = {
    buckets: {
        name?: string;
        creationDate?: Date;
    }[];
    owner: {
        id?: string;
        displayName?: string;
    };
};

export type UploadFileResponse = {
    objectKey: string;
    uri: string;
    /**
     * **DEPRECATED. This property will be removed in the next major version. Use `publicUrls` property instead.**
     * @deprecated
     */
    publicUrl: string | null;
    publicUrls: Array<string>;
    etag?: string;
    versionId?: string;
};

export type HeadObjectResponse = {
    lastModified?: Date;
    contentLength?: number;
    acceptRanges?: string;
    etag?: string;
    contentType?: string;
    customMetadata?: Record<string, string>;
};

export type CORSPolicy = {
    allowedHeaders?: string[];
    allowedMethods?: string[];
    allowedOrigins?: string[];
    exposeHeaders?: string[];
    id?: string;
    maxAgeSeconds?: number;
};

export type ObjectListResponse = {
    objects: {
        key?: string;
        lastModified?: Date;
        etag?: string;
        checksumAlgorithm?: string[];
        size?: number;
        storageClass?: string;
    }[];
    continuationToken?: string;
    nextContinuationToken?: string;
};
