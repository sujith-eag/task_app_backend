/**
 * Development Logger Utility
 * Provides structured logging with different levels for debugging
 * Only logs in development mode unless explicitly overridden
 */

const isDev = process.env.NODE_ENV !== 'production';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const levelColors = {
  debug: colors.gray,
  info: colors.blue,
  warn: colors.yellow,
  error: colors.red,
  success: colors.green,
};

const levelIcons = {
  debug: '🔍',
  info: 'ℹ️ ',
  warn: '⚠️ ',
  error: '❌',
  success: '✅',
};

/**
 * Format timestamp for logs
 */
const getTimestamp = () => {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

/**
 * Format a log message with color and metadata
 */
const formatMessage = (level, module, message, meta = null) => {
  const timestamp = getTimestamp();
  const color = levelColors[level] || colors.reset;
  const icon = levelIcons[level] || '';
  
  let output = `${colors.gray}[${timestamp}]${colors.reset} ${icon} ${color}[${level.toUpperCase()}]${colors.reset} ${colors.cyan}[${module}]${colors.reset} ${message}`;
  
  if (meta) {
    output += `\n${colors.gray}${JSON.stringify(meta, null, 2)}${colors.reset}`;
  }
  
  return output;
};

/**
 * Create a logger instance for a specific module
 * @param {string} moduleName - Name of the module for identification
 * @returns {Object} Logger instance with debug, info, warn, error, success methods
 */
export const createLogger = (moduleName) => {
  const log = (level, message, meta = null, forceLog = false) => {
    if (!isDev && !forceLog) return;
    
    const formattedMessage = formatMessage(level, moduleName, message, meta);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  };

  return {
    /**
     * Debug level - detailed debugging info, only in dev
     */
    debug: (message, meta = null) => log('debug', message, meta),
    
    /**
     * Info level - general information
     */
    info: (message, meta = null) => log('info', message, meta),
    
    /**
     * Warn level - warnings that don't stop execution
     */
    warn: (message, meta = null) => log('warn', message, meta),
    
    /**
     * Error level - errors (always logged in production)
     */
    error: (message, meta = null) => log('error', message, meta, true),
    
    /**
     * Success level - successful operations
     */
    success: (message, meta = null) => log('success', message, meta),
    
    /**
     * Log request details (for debugging API calls)
     */
    request: (req, additionalInfo = {}) => {
      if (!isDev) return;
      log('debug', `${req.method} ${req.originalUrl}`, {
        params: req.params,
        query: req.query,
        body: req.body,
        userId: req.user?._id,
        ...additionalInfo,
      });
    },
    
    /**
     * Log response details (for debugging API responses)
     */
    response: (statusCode, data = null, duration = null) => {
      if (!isDev) return;
      const meta = {
        statusCode,
        ...(duration && { duration: `${duration}ms` }),
        ...(data && typeof data === 'object' && { dataKeys: Object.keys(data) }),
      };
      log('debug', `Response: ${statusCode}`, meta);
    },
    
    /**
     * Log service operation
     */
    service: (operation, details = null) => {
      log('debug', `Service: ${operation}`, details);
    },
    
    /**
     * Log database operation
     */
    db: (operation, details = null) => {
      log('debug', `DB: ${operation}`, details);
    },

    /**
     * Time an async operation
     */
    time: async (label, asyncFn) => {
      const start = Date.now();
      try {
        const result = await asyncFn();
        const duration = Date.now() - start;
        log('debug', `${label} completed`, { duration: `${duration}ms` });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        log('error', `${label} failed`, { duration: `${duration}ms`, error: error.message });
        throw error;
      }
    },
  };
};

/**
 * Pre-configured loggers for common modules
 */
export const loggers = {
  admin: createLogger('Admin'),
  auth: createLogger('Auth'),
  db: createLogger('Database'),
  api: createLogger('API'),
  test: createLogger('Test'),
};

export default createLogger;
