import AuditLog from '../../../models/auditLogModel.js';
import { sanitizeForLog, deepSanitize } from '../utils/sanitize.js';

/**
 * Write a structured AuditLog entry.
 * options: { actor, action, entityType, entityId, before, after, req, context }
 */
export const logAudit = async (options = {}) => {
  const { actor, action, entityType, entityId, before, after, req, context } = options;
  try {
    const sBefore = deepSanitize(sanitizeForLog(before));
    const sAfter = deepSanitize(sanitizeForLog(after));

    // compute a minimal diff (shallow compare of top-level keys)
    const diff = {};
    if (sBefore && sAfter && typeof sBefore === 'object' && typeof sAfter === 'object') {
      const keys = new Set([...Object.keys(sBefore), ...Object.keys(sAfter)]);
      keys.forEach((k) => {
        const a = sBefore[k];
        const b = sAfter[k];
        try {
          if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = { before: a, after: b };
        } catch (e) {
          // ignore serialization errors
          if (a !== b) diff[k] = { before: a, after: b };
        }
      });
    }

    const entry = {
      actor: {
        user: actor && actor._id ? actor._id : actor || null,
        roles: actor && actor.roles ? actor.roles : undefined,
      },
      action: action || 'unknown',
      entityType: entityType || 'unknown',
      entityId: entityId ? String(entityId) : 'unknown',
      context,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.get ? req.get('User-Agent') : req?.headers?.['user-agent'] || null,
      data: {
        before: sBefore,
        after: sAfter,
        diff: Object.keys(diff).length ? diff : undefined,
      },
    };

    await AuditLog.create(entry);
  } catch (err) {
    // Don't let audit failures break the main flow
    console.error('Failed to write AuditLog entry:', err);
  }
};
