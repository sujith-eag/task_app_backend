## http

Small utilities for HTTP handlers and controllers used across the API.

Files

- `asyncHandler.js`
  - Default export: `asyncHandler(fn)` — a small wrapper that accepts an async Express handler and returns
    a function which calls `fn(req,res,next)` and catches any rejection, forwarding it to `next()` so the
    global error middleware handles it. This eliminates repetitive try/catch blocks in routes.
  - Example:
    ```js
    import asyncHandler from './asyncHandler.js';

    router.get('/', asyncHandler(async (req,res) => {
      const items = await Model.find();
      res.json(items);
    }));
    ```

- `pagination.js`
  - Exports:
    - `getPaginationMeta({page, limit, total})` — returns consistent pagination metadata (currentPage, itemsPerPage, totalItems, totalPages, hasNextPage, hasPrevPage).
    - `getSkip(page, limit)` — compute MongoDB `skip` value from page and limit.
    - `extractPaginationParams(query, defaults)` — parse/normalize `page` and `limit` from `req.query` with sane bounds.
  - Purpose: provide consistent pagination behavior across list endpoints and avoid repeating parse/validation logic.
  - Example usage:
    ```js
    import { extractPaginationParams, getPaginationMeta } from './pagination.js';

    router.get('/items', asyncHandler(async (req, res) => {
      const { page, limit, skip } = extractPaginationParams(req.query);
      const [items, total] = await Promise.all([
        Item.find().skip(skip).limit(limit),
        Item.countDocuments(),
      ]);
      res.json({ data: items, meta: getPaginationMeta({ page, limit, total }) });
    }));
    ```

Notes
- Keep pagination defaults consistent with frontend expectations (defaults provided in `extractPaginationParams`).
- `getSkip` and `extractPaginationParams` coerce and clamp inputs to avoid large or negative values.
