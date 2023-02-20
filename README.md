# Cloudflare-R2

This is a wrapper of the AWS S3 client library, designed to provide a user-friendly and efficient way to interact with Cloudflare R2 API in Node.js

### Why make this library?

-   As of the writing of this README, there is no official Node.js library for Cloudflare R2.
-   Interacting with object storage APIs, especially Cloudflare R2, should be simple and straightforward.

> ⚠ This library is currently in development and is not yet ready for production use. It is subject to change and may contain bugs or other issues. Please use it at your own risk.

### Installation

```bash
npm install node-cloudflare-r2
```

> It is highly recommended that you use a specific version number in your installation to anticipate any breaking changes that may occur in future releases. For example: \
> `npm install node-cloudflare-r2@1.0.0` \
> \
> Check the latest version number in the [release page](https://github.com/f2face/cloudflare-r2/releases).

### Example

```javascript
import { R2 } from 'node-cloudflare-r2';

const r2 = new R2({
    accountId: '<YOUR_ACCOUNT_ID>',
    accessKeyId: '<YOUR_R2_ACCESS_KEY_ID>',
    secretAccessKey: '<YOUR_R2_SECRET_ACCESS_KEY>',
});

const bucket = r2.bucket('<BUCKET_NAME>');

console.log(await bucket.exists());
```

