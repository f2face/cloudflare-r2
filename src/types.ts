export type CloudflareR2Config = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
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

export enum LocationHint {
    WesternNorthAmerica = 'wnam',
    EasternNorthAmerica = 'enam',
    WesternEurope = 'weur',
    EasternEurope = 'eeur',
    AsiaPacific = 'apac',
}

export type UploadFileResponse = {
    objectKey: string;
    uri: string;
    publicUrl: string | null;
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
