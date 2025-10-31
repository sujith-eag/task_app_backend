Phase 0: Recommended Codebase Architecture

Goals
- Domain-first modules with clear separation of concerns.
- Thin controllers, business logic in services, DB access in repositories.
- Consistent validators, policies, and middleware per domain.
- Ready for security, audit, and DevOps (structured logging, jobs, feature flags).

Recommended src/api structure
````text
src/
  api/
    files/
      routes/
        file.routes.js                # upload, download, rename, list (personal)
        folder.routes.js              # create/move/rename folders (personal)
      controllers/
        upload.controller.js
        download.controller.js
        list.controller.js            # replaces item.controller (personal context only)
        folder.controller.js
        rename.controller.js
      services/
        file.service.js               # create/list/rename/move (personal)
        folder.service.js
        path.service.js               # path compute/rewrite helpers
      validators/
        upload.validators.js
        folder.validators.js
        files.validators.js           # list/rename/move
      policies/
        files.policies.js             # ownership checks, context guard
      mappers/
        file.mapper.js                # response shape, redaction
      README.md

    shares/                           # all sharing, including public + class, via FileShare model
      routes/
        shares.routes.js              # POST/DELETE /:fileId/share, GET /mine, etc.
        public.routes.js              # POST /public-download, GET /public-preview
      controllers/
        shares.controller.js
        public.controller.js
      services/
        shares.service.js             # grants, revocations, expiry checks
        access.service.js             # resolves effective access (owner/share/class)
      validators/
        shares.validators.js
      policies/
        shares.policies.js
      README.md

    trash/
      routes/
        trash.routes.js               # GET trash, POST restore, DELETE purge, DELETE hard (admin)
      controllers/
        trash.controller.js
      services/
        trash.service.js              # soft-delete, recursive ops, restore, purge
      validators/
        trash.validators.js
      policies/
        trash.policies.js
      README.md

    academics/                        # subject materials (system-owned)
      routes/
        materials.routes.js           # list/browse academic materials by subject/class
      controllers/
        materials.controller.js
      services/
        materials.service.js          # listing, access rules, folder provisioning
      validators/
        materials.validators.js
      policies/
        academics.policies.js
      README.md

    assignments/                      # assignment definition + student submissions
      routes/
        assignments.routes.js         # CRUD assignments (teacher/admin), listing for students
        submissions.routes.js         # submit/resubmit/reject/grade/download
      controllers/
        assignments.controller.js     # create/update/delete assignment
        submissions.controller.js     # lazy-provision, submit (permission flip), reject, grade
      services/
        assignments.service.js
        submissions.service.js
        workspace.service.js          # draft folder provisioning and ownership flips
      validators/
        assignments.validators.js
        submissions.validators.js
      policies/
        assignments.policies.js       # isTeacherOfClass, isStudentOfClass, deadline guards
      README.md

    attendance/
      routes/
        attendance.routes.js          # CRUD/list attendance records (new AttendanceRecord)
      controllers/
        attendance.controller.js
      services/
        attendance.service.js
      validators/
        attendance.validators.js
      policies/
        attendance.policies.js
      README.md

    admin/
      routes/
        admin.routes.js               # mount sub-routes
        applications.routes.js
        management.routes.js
        reports.routes.js
        teacher-assignments.routes.js # existing teacher-subject mapping (kept here)
      controllers/
        applications.controller.js
        management.controller.js
        reports.controller.js
        teacher-assignments.controller.js
      services/
        applications.service.js
        management.service.js
        reports.service.js
        teacher-assignments.service.js
      validators/
        applications.validators.js
        management.validators.js
        teacher-assignments.validators.js
      policies/
        admin.policies.js
      README.md

    search/
      routes/
        search.routes.js              # full-text search for personal files (respects isDeleted)
      controllers/
        search.controller.js
      services/
        search.service.js
      validators/
        search.validators.js

    audit/
      routes/
        audit.routes.js               # admin-only viewing (optional)
      controllers/
        audit.controller.js
      services/
        audit.service.js              # append-only logging API used by all domains
      README.md

    users/
      routes/
        users.routes.js               # profile, avatar upload
      controllers/
        users.controller.js
      services/
        users.service.js
      validators/
        users.validators.js
      policies/
        users.policies.js

    _common/                          # shared web concerns across domains
      middleware/
        auth.middleware.js            # protect, attach user
        rbac.middleware.js            # isAdmin, isHod, isTeacher, isStudent; roles array aware
        quota.middleware.js           # counts only context: 'personal', highest-role logic
        context.guard.js              # enforce context boundary, forbid cross-context moves
        auditLog.middleware.js        # auto-emit audit entries on mutating requests
        timing.middleware.js          # request timing logs
        requestId.middleware.js       # x-request-id
        error.middleware.js           # error handler
      http/
        asyncHandler.js
        pagination.js
      utils/
        objectId.js
        sanitize.js
        caching.js

  models/
    file.model.js
    fileshare.model.js                # new
    assignment.model.js               # new
    assignmentSubmission.model.js     # new
    auditLog.model.js                 # new
    attendanceRecord.model.js         # new
    user.model.js
    subject.model.js
    classSession.model.js             # will deprecate embedded attendance

  services/
    s3/
      s3.service.js                   # upload, delete, signed URL (preview/download)
      keybuilder.js                   # {env}/{context}/{ownerId}/{yyyy}/{mm}/{uuid}
    logger/
      logger.js                       # pino or winston JSON logger
    mailer/
      mailer.service.js
    jobs/
      scheduler.js                    # node-cron or BullMQ
      trashPurge.job.js               # purge soft-deleted > N days
    config/
      featureFlags.js                 # softDeleteEnabled, fileShareEnabled, contextEnforced
      security.js                     # CORS, helmet options
      rateLimit.js

  routes/
    index.js                          # mounts all api/* routes with base paths

  loaders/
    express.js                        # app setup, middleware, routes
    mongo.js                          # connection, index creation
    socket.js                         # socket.io binding

  app.js                              # bootstrap using loaders
  server.js                           # HTTP/Socket server (existing)
````

Key refactors from current code
- Files module
  - Move current controllers into files/ with clearer responsibilities:
    - item.controller.js -> list.controller.js (personal context only).
    - delete.controller.js -> trash controller/service (soft-delete).
    - folder.controller.js -> create/move under folder.controller.js; recursive path updates in folder.service.js.
    - public.controller.js moves under shares/public.controller.js.
- Shares module
  - All sharing logic leaves File model and controllers to a dedicated module using FileShare model.
  - Includes public links, direct user share, and class share.
- Assignments module
  - New module for Assignment and AssignmentSubmission workflows, permission flip via workspace.service.
- Academics module
  - Materials listing backed by admin-owned folders/files in context: 'academic_material'.
- Trash module
  - Centralizes soft-delete, restore, purge, and admin hard-delete.
- Attendance module
  - New endpoints around AttendanceRecord model; begin deprecating embedded records in ClassSession.
- Common middleware
  - Central auditLog middleware to capture state-changing requests.
  - context.guard to enforce context and 2-level folder limit on create/move.
  - quota.middleware to apply personal-only quotas based on highest role.

Routing and mounts (example)
- /api/files -> files/routes/file.routes.js, files/routes/folder.routes.js
- /api/shares -> shares/routes/shares.routes.js, shares/routes/public.routes.js
- /api/trash -> trash/routes/trash.routes.js
- /api/academics -> academics/routes/materials.routes.js
- /api/assignments -> assignments/routes/assignments.routes.js
- /api/submissions -> assignments/routes/submissions.routes.js
- /api/admin -> admin/routes/*.routes.js
- /api/attendance -> attendance/routes/attendance.routes.js
- /api/search -> search/routes/search.routes.js
- /api/users -> users/routes/users.routes.js

Layering conventions
- Controller: request validation, call service, map response, set status.
- Service: business rules, transaction orchestration, call repositories/services, raise domain errors.
- Repository (optional): if data access becomes complex, encapsulate Mongoose queries; otherwise services may call models directly.
- Policies: declarative authorization checks per domain (teacher of class, student of class, owner).
- Validators: Joi schemas per route; applied in route files.
- Mappers: shape DB docs to response DTOs; hide internal fields.
- Middleware: cross-cutting concerns (auth, rbac, audit, quota, context guard, error handling).

DevOps/Security hooks
- Logger: Pino/Winston JSON logger in services/logger.
- Audit: audit.service used by auditLog.middleware and directly in services for critical events.
- Jobs: trashPurge.job scheduled via services/jobs/scheduler.js.
- Feature flags: config/featureFlags.js to gate soft-delete, context enforcement, fileshare.
- S3: s3.service with structured keys and separate getPreviewUrl/getDownloadUrl.

Testing and fixtures (optional)
```
- tests/unit/<domain>/*
- tests/integration/<domain>/*
- fixtures/<domain>/*
```

