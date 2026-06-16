# Cloudflare-R2

S3-compatible client wrapper for Cloudflare R2, supporting both ESM and CommonJS.

### Why make this library?

- Interacting with object storage APIs, especially Cloudflare R2, should be simple and straightforward.
- No official Node.js library exists for Cloudflare R2; the AWS SDK works but requires boilerplate.

## Installation

```bash
npm install node-cloudflare-r2
# or
pnpm install node-cloudflare-r2
```

> It is recommended to pin a specific version to avoid unexpected breaking changes. Check the [release page](https://github.com/f2face/cloudflare-r2/releases) for the latest version.

## Usage

The package supports both `import` (ESM) and `require` (CommonJS).

```js
// ESM
import { R2 } from 'node-cloudflare-r2';

// CommonJS
const { R2 } = require('node-cloudflare-r2');
```

For TypeScript, types are available at the top level and via the `types` subpath:

```ts
import type { CloudflareR2Config, UploadStreamOptions } from 'node-cloudflare-r2/types';
```

### Basic usage

```js
const r2 = new R2({
    accountId: '<YOUR_ACCOUNT_ID>',
    accessKeyId: '<YOUR_R2_ACCESS_KEY_ID>',
    secretAccessKey: '<YOUR_R2_SECRET_ACCESS_KEY>',
});

const bucket = r2.bucket('<BUCKET_NAME>');

// Provide the public URL(s) of your bucket (optional, if public access is enabled)
bucket.provideBucketPublicUrl('https://pub-xxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev');

console.log(await bucket.exists()); // true
```

### Upload a local file

```js
const upload = await bucket.uploadFile('/path/to/file', 'destination_file_name.ext');
console.log(upload);
/*
{
    objectKey: 'destination_file_name.ext',
    uri: 'destination_file_name.ext',
    publicUrl: 'https://pub-xxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev/destination_file_name.ext',
    publicUrls: ['https://pub-xxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev/destination_file_name.ext'],
    etag: '',
    versionId: '',
}
*/
```

### Upload string, buffer, or stream

```js
// Text content
await bucket.upload('Lorem ipsum', 'lorem-ipsum.txt');

// From a readable stream
import { createReadStream } from 'fs';
const stream = createReadStream('/path/to/file');
await bucket.upload(stream, 'destination_file_name2.ext');
```

### Upload with multipart (large files)

Use `uploadStream()` for large files or live streams. It uses multipart upload internally and accepts tuning options to avoid the 10,000 part limit.

```js
import { spawn } from 'child_process';

const streamlink = spawn('streamlink', ['--stdout', '<LIVE_STREAM_HLS_URL>', 'best']);

// With default multipart settings
await bucket.uploadStream(streamlink.stdout, 'my_live_stream.ts');

// With custom part size and concurrency (for very large files)
await bucket.uploadStream(largeBuffer, 'bigfile.bin', undefined, undefined, undefined, {
    partSize: 50 * 1024 * 1024, // 50 MB per part
    queueSize: 8, // 8 concurrent uploads
});
```

### Generate signed URLs

```js
// GET signed URL (expires after 3600 seconds)
const getUrl = await bucket.getObjectSignedUrl('file.ext', 3600);

// PUT signed URL (expires after 3600 seconds)
const putUrl = await bucket.putObjectSignedUrl('file.ext', 3600);
```

[More about signed URLs on R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/#generate-presigned-urls)

## API

### R2

#### `new R2(config, overrides?)`

Creates a new R2 client instance.

```js
const r2 = new R2({
    accountId: '<YOUR_ACCOUNT_ID>',
    accessKeyId: '<YOUR_R2_ACCESS_KEY_ID>',
    secretAccessKey: '<YOUR_R2_SECRET_ACCESS_KEY>',
    jurisdiction: 'eu', // optional: 'eu' or 'fedramp'
});
```

You can also pass S3 client overrides as a second argument:

```js
const r2 = new R2(config, { endpoint: 'https://custom.example.com' });
```

#### `r2.bucket(bucketName)`

Returns a `Bucket` instance for the given bucket name.

```js
const bucket = r2.bucket('my-bucket');
```

#### `r2.listBuckets()`

Returns all buckets owned by the authenticated account.

```js
const { buckets, owner } = await r2.listBuckets();
// buckets: [{ name, creationDate }, ...]
// owner: { id, displayName }
```

#### `r2.bucketExists(bucketName)`

Returns `true` if the bucket exists and you have permission to access it.

```js
if (await r2.bucketExists('my-bucket')) { ... }
```

#### `r2.createBucket(bucketName)`

Creates a new bucket and returns a `Bucket` instance.

```js
const bucket = await r2.createBucket('new-bucket');
```

#### `r2.deleteBucket(bucketName)`

Deletes a bucket. Returns `true` on success, throws on failure.

```js
await r2.deleteBucket('old-bucket');
```

#### `r2.getBucketCors(bucketName)`

Returns the CORS configuration for a bucket. Shortcut for `r2.bucket(name).getCorsPolicies()`.

```js
const policies = await r2.getBucketCors('my-bucket');
```

#### `r2.getBucketRegion(bucketName)`

Returns the region of a bucket. For Cloudflare R2 this is always `'auto'`.

```js
const region = await r2.getBucketRegion('my-bucket'); // 'APAC'
```

---

### Bucket

#### `bucket.name` / `bucket.uri`

Read-only properties for the bucket name and its R2 endpoint URI.

#### `bucket.exists()`

Returns `true` if the bucket exists and is accessible.

```js
console.log(await bucket.exists()); // true
```

#### `bucket.upload(contents, destination, customMetadata?, mimeType?)`

Uploads a string, `Buffer`, `Uint8Array`, or `Readable` stream to the bucket.

```js
await bucket.upload('Hello world', 'hello.txt');
await bucket.upload(buffer, 'data.bin', { author: 'me' }, 'application/octet-stream');
```

#### `bucket.uploadFile(filePath, destination?, customMetadata?, mimeType?)`

Uploads a local file from disk. If `destination` is omitted, the file's basename is used.

```js
await bucket.uploadFile('/path/to/photo.jpg');
await bucket.uploadFile('/path/to/video.mp4', 'videos/intro.mp4');
```

#### `bucket.uploadStream(contents, destination, customMetadata?, mimeType?, onProgress?, options?)`

Uploads using multipart upload internally. Best for large files or live streams. Use the `options` parameter to tune part size and concurrency.

```js
// Basic
await bucket.uploadStream(largeBuffer, 'bigfile.bin');

// With progress tracking
await bucket.uploadStream(stream, 'bigfile.bin', undefined, undefined, (progress) => {
    console.log(`${progress.loaded} / ${progress.total} bytes`);
});

// With custom part size (avoid 10,000 part limit for very large files)
await bucket.uploadStream(stream, 'huge.bin', undefined, undefined, undefined, {
    partSize: 50 * 1024 * 1024, // 50 MB per part
    queueSize: 8, // 8 concurrent uploads
});
```

All upload methods return an `UploadFileResponse`:

```ts
{ objectKey, uri, publicUrl, publicUrls, etag?, versionId? }
```

#### `bucket.deleteObject(objectKey)`

Deletes an object from the bucket.

```js
await bucket.deleteObject('old-file.txt');
```

#### `bucket.headObject(objectKey)`

Returns metadata for an object without downloading it.

```js
const meta = await bucket.headObject('file.txt');
// { lastModified, contentLength, acceptRanges, etag, contentType, customMetadata }
```

#### `bucket.listObjects(maxResults?, marker?)`

Lists up to 1,000 objects in the bucket. Use `marker` for pagination.

```js
const page1 = await bucket.listObjects(100);
// { objects, continuationToken, nextContinuationToken }

// Next page
const page2 = await bucket.listObjects(100, page1.nextContinuationToken);
```

Each object in the list: `{ key, lastModified, etag, checksumAlgorithm, size, storageClass }`.

#### `bucket.copyObject(sourceKey, destinationKey)`

Copies an object within the same bucket.

```js
await bucket.copyObject('source.txt', 'backup/copy.txt');
```

#### `bucket.objectExists(objectKey)`

Returns `true` if the object exists in the bucket.

```js
if (await bucket.objectExists('file.txt')) { ... }
```

#### `bucket.getObjectPublicUrls(objectKey)`

Returns all public URLs for an object (requires `provideBucketPublicUrl` to be set first).

```js
bucket.provideBucketPublicUrl('https://pub-xxxx.r2.dev');
console.log(bucket.getObjectPublicUrls('photo.jpg'));
// ['https://pub-xxxx.r2.dev/photo.jpg']
```

#### `bucket.getObjectSignedUrl(objectKey, expiresIn)` / `bucket.putObjectSignedUrl(objectKey, expiresIn)`

Generates pre-signed URLs for GET or PUT operations, valid for `expiresIn` seconds.

```js
const getUrl = await bucket.getObjectSignedUrl('file.pdf', 3600);
const putUrl = await bucket.putObjectSignedUrl('uploads/file.pdf', 7200);
```

#### `bucket.getCorsPolicies()`

Returns the CORS configuration of the bucket.

```js
const policies = await bucket.getCorsPolicies();
// [{ allowedHeaders, allowedMethods, allowedOrigins, exposeHeaders, id, maxAgeSeconds }]
```

#### `bucket.getRegion()` / `bucket.getEncryption()`

```js
console.log(await bucket.getRegion()); // 'APAC'
console.log(await bucket.getEncryption()); // [{ applyServerSideEncryptionByDefault, bucketKeyEnabled }]
```

#### `bucket.provideBucketPublicUrl(url)` / `bucket.getPublicUrls()`

Sets and retrieves the public-facing URL(s) for the bucket. Accepts a single URL or an array.

```js
bucket.provideBucketPublicUrl('https://pub-xxxx.r2.dev');
// or multiple custom domains
bucket.provideBucketPublicUrl(['https://cdn1.example.com', 'https://cdn2.example.com']);

console.log(bucket.getPublicUrls());
// ['https://pub-xxxx.r2.dev', 'https://cdn1.example.com', 'https://cdn2.example.com']
```

## Credits

Thanks to all [contributors](https://github.com/f2face/cloudflare-r2/graphs/contributors) who have helped improve this project.
