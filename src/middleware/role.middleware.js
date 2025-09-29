// @desc    Middleware to check if the user has a specific role or set of roles.
// This should be placed after the 'protect' middleware in the route chain.
// @param   {string[]} roles - An array of strings representing the allowed roles.
// @returns {function} Express middleware function.

const hasRole = (roles) => {
  return (req, res, next) => {
    // 'protect' middleware has attached req.user
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403); // 403 Forbidden
      throw new Error('Not authorized. You do not have the required permissions.');
    }
    next();
  };
};

// Specific role checks for convenience and readability in route definitions
export const isStudent = hasRole(['student']);
export const isTeacher = hasRole(['teacher']);
export const isAdmin = hasRole(['admin']);
export const isHOD = hasRole(['hod']);
export const isAdminOrHOD = hasRole(['admin', 'hod']);