import rateLimit from 'express-rate-limit';

/**
 * Stricter limit for login and password reset attempts
 * Prevents brute-force attacks on authentication endpoints
 */
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Each IP, 10 requests per windowMs
    message: 'Too many authentication attempts from this IP, please try again after 10 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Lenient general purpose rate limiter
 * For most API endpoints that don't require stricter limits
 */
export const generalApiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 100, // Each IP, 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Stricter limiter for file downloads
 * Prevents abuse of bandwidth and storage resources
 */
export const downloadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // Limit each IP to 20 download requests per 10 minutes
    message: 'Too many download requests from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Rate limiter for public API endpoints
 * Stricter than general API to prevent abuse of public resources
 */
export const publicApiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 70, // Limit each IP to 70 requests per 10 minutes
    message: 'Too many requests from this IP, please try again after 10 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});
