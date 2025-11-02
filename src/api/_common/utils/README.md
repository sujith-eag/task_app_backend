## utils

Common utility helpers used throughout the backend.

Files

- `caching.js`
  - Simple in-memory cache wrapper around `node-cache`.
  - Exports: `get`, `set`, `del`, `has`, `flush`, `getStats` and a default export object.
  - Purpose: cache short-lived values such as S3 pre-signed URLs (default TTL 50s). Keep TTL slightly less
    than external expiry to avoid returning an already-expired value.

- `objectId.js`
  - Exports: `isValidObjectId`, `toObjectId`, `areValidObjectIds`.
  - Purpose: centralize MongoDB ObjectId validation and conversion helpers. `toObjectId` throws on invalid ids
    which is useful for early validation in route handlers.

- `sanitize.js`
  - Exports: `sanitizeForLog`, `sanitizeHtml`, `normalizeString`, `sanitizeFilename`, `deepSanitize`.
  - Purpose: utilities to sanitize objects for logging, normalize user input (emails/usernames), basic XSS
    escaping for strings, and sanitize filenames for safe storage.

Usage examples

Caching (S3 pre-signed URL example):

```js
import cache from '../_common/utils/caching.js';

const key = `s3:presign:${fileId}`;
let url = cache.get(key);
if (!url) {
  url = await s3.getPresignedUrl(...);
  cache.set(key, url, 50); // store 50s TTL (default)
}
```

ObjectId validation example:

```js
import { toObjectId } from '../_common/utils/objectId.js';

const id = toObjectId(req.params.id, 'fileId');
```

Sanitization example:

```js
import { sanitizeForLog, deepSanitize } from '../_common/utils/sanitize.js';

const safe = sanitizeForLog(userDoc);
const deepSafe = deepSanitize(req.body);
```

Notes & guidance
- These utilities are intentionally minimal and synchronous. For production-scale caching or cross-process
  sharing prefer Redis or another external cache.
- `sanitizeForLog` removes common sensitive fields (passwords, tokens, sessions). If you have additional PII
  in your models, extend the list or perform domain-specific redaction before logging.
