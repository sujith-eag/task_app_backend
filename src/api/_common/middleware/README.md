## _common/middleware

This folder contains the centralized, canonical middleware used across the backend API. The intent is to
provide a single, well-documented place for cross-cutting concerns (auth, RBAC, validation, rate-limiting, file
uploads, quotas, AI limits and global error handling) and to make incremental migration away from legacy
`/src/middleware/*` files safe and simple.

Key principles
- Cookie-first auth: browser sessions should use an httpOnly cookie named `jwt`. Server-side middleware will
  prefer this cookie but falls back to the `Authorization: Bearer <token>` header and `req.body.token` for
  non-browser clients.
- Backwards compatibility: legacy files under `backend/src/middleware/*.js` are lightweight shims that re-export
  from this folder and emit deprecation warnings. Import new code from `backend/src/api/_common/middleware/...`.
- Defensive APIs: some middleware avoids assigning to potentially read-only `req` properties and attaches
  validated data to `req.validated` (and legacy `req.validated_*`) when necessary.

Files and summaries

- auth.middleware.js
  - Exports: `protect` (Express middleware), `socketAuthMiddleware` (Socket.IO middleware)
  - Purpose: Authenticate requests using JWT. `protect` attaches `req.user`. `socketAuthMiddleware` accepts
    tokens from `socket.handshake.auth.token`, the `Authorization` header, or the cookie header (parses `jwt`).
  - Notes: `protect` returns 401 JSON responses for unauthenticated requests. Socket middleware provides
    richer debug logs to help diagnose handshake issues and attaches `socket.user` on success.

- rbac.middleware.js
  - Exports: `hasRole`, `isStudent`, `isTeacher`, `isAdmin`, `isHOD`, `isAdminOrHOD`, `authorize` (alias)
  - Purpose: Simple role-based access control middleware. Use after `protect`.
  - Usage: `router.get('/', protect, isTeacher, handler)` or `router.post('/', protect, hasRole(['admin','hod']), handler)`.

- error.middleware.js
  - Default export: `errorHandler` (Express error handling middleware)
  - Purpose: Global error handler; special-cases Multer errors and invalid file types. Shows stack traces only in
    non-production.
  - Usage: Register as the last middleware in your Express app: `app.use(errorHandler)`.

- file.middleware.js
  - Exports: `uploadFiles` (multer.array('files', 8)), `uploadAvatar` (multer.single('avatar'))
  - Purpose: Multer middleware configured with memory storage, sensible file filters and limits (20MB file limit
    for general files, 5MB for avatars). Accepts a wide set of mimetypes and falls back to `application/octet-stream`.
  - Notes: File filters throw `Error('Invalid file type.')` when rejecting — the global error handler maps this to
    a 400 response.

- quota.middleware.js
  - Exports: `QUOTAS` (object), `checkStorageQuota` (middleware)
  - Purpose: Enforce per-role storage quotas (file count and total size) for 'personal' files. Uses aggregation to
    compute current usage and compares against configured limits.
  - Notes: HOD and Admin have unlimited quotas. Must be used after `protect` and before file processing routes.

- rateLimit.middleware.js
  - Exports: `authLimiter`, `generalApiLimiter`, `downloadLimiter`, `publicApiLimiter`
  - Purpose: Pre-configured express-rate-limit instances for common needs (auth endpoints, general API, downloads,
    public endpoints). Import and attach to routes as appropriate.

- aiLimit.middleware.js
  - Exports: `checkAIDailyLimit`
  - Purpose: Enforces a per-user daily quota for AI generation requests. Uses `process.env.DAILY_AI_GENERATION_LIMIT`
    (defaults to 10). Must be used after `protect`.

- validation.middleware.js
  - Exports: `validate(schemas)` (and default export)
  - Purpose: Joi-based validator for `req.params`, `req.query` and `req.body`. Validates and coerces input and
    attempts to replace the corresponding `req` properties with validated values.
  - Compatibility: In environments where `req.params` / `req.query` / `req.body` are read-only, the middleware
    falls back to attaching validated values under `req.validated` and also sets legacy per-property names
    `req.validated_params`, `req.validated_query`, `req.validated_body` for older modules that still look for them.
  - Error handling: Joi validation errors are replied with `400` and `{ errors: [{ message, path }] }`.

Usage examples

Express route (protect + roles + validation + quota + upload):

```js
import express from 'express';
import { protect, socketAuthMiddleware } from './auth.middleware.js';
import { isTeacher } from './rbac.middleware.js';
import { validate } from './validation.middleware.js';
import { checkStorageQuota } from './quota.middleware.js';
import { uploadFiles } from './file.middleware.js';

const router = express.Router();

const createFilesSchema = {
  body: Joi.object({ context: Joi.string().valid('personal','shared').required() }),
};

router.post('/upload', protect, isTeacher, validate(createFilesSchema), checkStorageQuota, uploadFiles, async (req, res) => {
  // validated inputs may be on req.body or req.validated.body
  const body = (req.validated && req.validated.body) || req.body;
  // req.files is populated by multer
  res.json({ success: true, fileCount: req.files.length });
});
```

Socket.IO usage

Server side: attach `socketAuthMiddleware` when configuring namespaces or the main io instance. Example (express + io):

```js
io.use(socketAuthMiddleware);
io.on('connection', (socket) => {
  // socket.user is available here
});
```

Client handshake hints:
- Browsers: the server expects the httpOnly `jwt` cookie; ensure your client connects with credentials (axios or
  socket.io-client with withCredentials / transports options) so the cookie is included in the handshake.
- Alternative: supply `auth: { token: '<jwt>' }` when connecting via socket.io-client or use the Authorization header.

Migration notes & compatibility
- Legacy path: `backend/src/middleware/<name>.js` files currently re-export these implementations and log a
  deprecation warning. Please update imports to `backend/src/api/_common/middleware/<name>.js` to reduce noise and
  avoid future removal.
- Validation middleware: modules that relied on direct assignment to `req.query` / `req.params` should prefer
  `req.validated` where appropriate. The middleware still sets `req.validated_*` for compatibility.

Edge cases & troubleshooting
- Socket auth failures: middleware logs a small debug object including handshake.auth and a cookie snippet — use
  that output to correlate client and server logs.
- Multer / file filter errors: these surface as errors with messages like `Invalid file type.` or MulterError codes —
  the global error handler maps those to friendly HTTP responses.
- Rate limits: tune `rateLimit.middleware.js` values in case your deployment or CDN changes request distribution.

Contract (quick)
- Inputs: Express `req`/`res` and Socket `socket` handshake objects
- Outputs: either `next()` on success, `res.status(...).json(...)` for standard API errors, or `next(Error)` for
  socket middleware.
- Error modes: validation 400, auth 401, permission 403, quota 403, rate-limit 429/optionally message from
  express-rate-limit.

Next steps
- Update feature README files to reference these canonical middleware exports and provide migration examples.
- Run end-to-end tests (login, cookie set, /auth/me, socket connect) in a local environment to validate cookie-first
  behavior.

If anything in this README looks inaccurate compared to the code, tell me which file to re-open and I'll update
the README accordingly.
