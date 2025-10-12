import rateLimit from 'express-rate-limit';

// Stricter limit for login and password reset attempts
export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // Each IP, 10 requests per windowMs
    message: 'Too many authentication attempts from this IP, please try again after 10 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

// Lenient general purpose limiter
export const generalApiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 100, // Each IP, 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limiter for file downloads
export const downloadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20, // Limit each IP to 20 download requests per 10 minutes
    message: 'Too many download requests from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

export const publicApiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 70, // Limit each IP to 15 requests per 10 minutes
    message: 'Too many requests from this IP, please try again after 10 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});
