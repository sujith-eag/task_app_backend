/**
 * User Policies
 * Authorization checks specific to user operations
 */

/**
 * Check if the requesting user is accessing their own resource
 * Ensures users can only modify their own data
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
export const isSelf = (req, res, next) => {
    // For routes like /me, the user is always accessing their own resource
    // This is a placeholder policy for explicit self-access checks
    
    // If a userId param exists, verify it matches the authenticated user
    if (req.params.userId && req.params.userId !== req.user._id.toString()) {
        res.status(403);
        return next(new Error('You can only access your own profile'));
    }
    
    next();
};

/**
 * Check if user can submit a student application
 * Verifies user is in a valid state to apply
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
export const canApplyAsStudent = (req, res, next) => {
    const user = req.user;
    
    // Check if user already has a role other than 'user'
    // Require that the user's roles array is exactly ['user'] to be eligible
    if (!Array.isArray(user.roles) || !(user.roles.length === 1 && user.roles[0] === 'user')) {
        res.status(403);
        return next(new Error('Only basic users can apply to become students'));
    }
    
    // Check application status
    const status = user.studentDetails?.applicationStatus;
    
    if (status === 'pending') {
        res.status(400);
        return next(new Error('You already have a pending application'));
    }
    
    if (status === 'approved') {
        res.status(400);
        return next(new Error('Your application has already been approved'));
    }
    
    next();
};

/**
 * Check if user is verified
 * Ensures only verified users can access certain features
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
export const isVerified = (req, res, next) => {
    if (!req.user.isVerified) {
        res.status(403);
        return next(new Error('Please verify your email address to access this feature'));
    }
    next();
};

/**
 * Check if user account is active
 * Prevents banned/inactive users from accessing resources
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
export const isActive = (req, res, next) => {
    if (!req.user.isActive) {
        res.status(403);
        return next(new Error('Your account has been deactivated. Please contact support.'));
    }
    next();
};
