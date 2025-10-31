/**
 * Pagination Helper
 * Provides consistent pagination across the application
 * 
 * @param {Object} options - Pagination options
 * @param {number} options.page - Current page number (1-indexed)
 * @param {number} options.limit - Number of items per page
 * @param {number} options.total - Total number of items
 * @returns {Object} Pagination metadata
 */
export const getPaginationMeta = ({ page = 1, limit = 10, total = 0 }) => {
    const currentPage = parseInt(page, 10);
    const itemsPerPage = parseInt(limit, 10);
    const totalPages = Math.ceil(total / itemsPerPage);

    return {
        currentPage,
        itemsPerPage,
        totalItems: total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
    };
};

/**
 * Calculate skip value for MongoDB queries
 * 
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Number of items per page
 * @returns {number} Number of documents to skip
 */
export const getSkip = (page = 1, limit = 10) => {
    const currentPage = parseInt(page, 10);
    const itemsPerPage = parseInt(limit, 10);
    return (currentPage - 1) * itemsPerPage;
};

/**
 * Extract pagination parameters from request query
 * 
 * @param {Object} query - Express request query object
 * @param {Object} defaults - Default values for page and limit
 * @returns {Object} Parsed pagination parameters
 */
export const extractPaginationParams = (query, defaults = { page: 1, limit: 10 }) => {
    const page = Math.max(1, parseInt(query.page, 10) || defaults.page);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || defaults.limit));

    return {
        page,
        limit,
        skip: getSkip(page, limit),
    };
};
