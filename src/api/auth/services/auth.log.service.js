import AuthEvent from '../../../models/authEventModel.js';

/**
 * Centralized auth event logger
 * @param {Object} options
 *  - userId, actor, eventType, severity, context, req
 */
export const logAuthEvent = async (options) => {
  const { userId, actor, eventType, severity, context, req } = options;
  try {
    await AuthEvent.create({
      userId: userId || null,
      actor: actor || (req?.body?.email || 'unknown'),
      eventType,
      severity: severity || 'info',
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
      userAgent: req?.get ? req.get('User-Agent') : req?.headers?.['user-agent'] || null,
      context: context || {},
    });
  } catch (err) {
    // Logging should not break authentication flow
    console.error('Failed to write AuthEvent:', err);
  }
};
