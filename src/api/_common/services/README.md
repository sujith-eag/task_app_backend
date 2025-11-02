## services

Shared service utilities used by API routes and domain logic.

Files

- `audit.service.js`
  - Exports: `logAudit(options)` — writes a structured `AuditLog` entry to the database.
  - Purpose: record an actor, action, target entity, and before/after snapshots in a safe, sanitized form for
    audit and compliance. The service attempts to compute a shallow diff between `before` and `after` and
    persists a compact entry using the `AuditLog` mongoose model.
  - Typical options:
    ```js
    {
      actor,        // user object or user id
      action,       // string e.g. 'update:task'
      entityType,   // string e.g. 'task'
      entityId,     // id of the entity
      before,       // previous state
      after,        // new state
      req,          // optional express request (used to extract ip and user-agent for context)
      context       // optional context string
    }
    ```
  - Behavior: the service sanitizes values (via `../utils/sanitize.js`), computes a minimal diff, and creates an
    AuditLog record. Failures are logged to the console but do not throw, so audit errors won't break primary flows.

Usage

Call `logAudit` after domain-changing operations (create/update/delete) to provide an immutable record of who did
what and when. Example:

```js
import { logAudit } from '../_common/services/audit.service.js';

await logAudit({ actor: req.user, action: 'update:task', entityType: 'task', entityId: task._id, before: oldTask, after: task, req });
```

Notes & recommendations
- Audit entries should avoid storing sensitive raw data. The service sanitizes incoming objects, but consider
  additional application-level redaction for particularly sensitive fields.
- For high-throughput systems consider batching audit writes or using an append-only event stream instead of
  synchronous DB writes.
