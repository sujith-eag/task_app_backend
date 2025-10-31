import NodeCache from 'node-cache';

/**
 * Simple in-memory cache using node-cache
 * Used for caching S3 pre-signed URLs and other temporary data
 */

// Create a cache instance with default TTL of 50 seconds
// This is slightly less than S3 URL expiration (60s) to ensure fresh URLs
const cache = new NodeCache({
    stdTTL: 50, // Default TTL in seconds
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false, // Don't clone objects (better performance)
});

/**
 * Get a value from cache
 * 
 * @param {string} key - Cache key
 * @returns {*} Cached value or undefined if not found/expired
 */
export const get = (key) => {
    return cache.get(key);
};

/**
 * Set a value in cache
 * 
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional, uses default if not provided)
 * @returns {boolean} True if successful
 */
export const set = (key, value, ttl) => {
    return cache.set(key, value, ttl);
};

/**
 * Delete a value from cache
 * 
 * @param {string} key - Cache key
 * @returns {number} Number of deleted entries
 */
export const del = (key) => {
    return cache.del(key);
};

/**
 * Check if a key exists in cache
 * 
 * @param {string} key - Cache key
 * @returns {boolean} True if key exists
 */
export const has = (key) => {
    return cache.has(key);
};

/**
 * Flush all cached data
 */
export const flush = () => {
    cache.flushAll();
};

/**
 * Get cache statistics
 * 
 * @returns {Object} Cache stats
 */
export const getStats = () => {
    return cache.getStats();
};

export default {
    get,
    set,
    del,
    has,
    flush,
    getStats,
};
