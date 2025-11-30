import User from '../../../../models/userModel.js';
import { populateTemplate } from '../../../../utils/emailTemplate.js';
import { sendEmail } from '../../../../services/email.service.js';
import { logAuthEvent } from '../../../auth/services/auth.log.service.js';
import { logAudit } from '../../../_common/services/audit.service.js';

// ============================================================================
// Application Services
// ============================================================================

/**
 * Get all pending student applications with pagination
 * @param {Object} options - Pagination and search options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.search=''] - Search term for name, email, or USN
 * @returns {Promise<Object>} Paginated applications with metadata
 */
export const getPendingApplications = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    search = '',
  } = options;

  const skip = (Math.max(1, page) - 1) * limit;

  // Build query
  const query = {
    'studentDetails.applicationStatus': 'pending',
  };

  // Add search if provided
  if (search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { 'studentDetails.usn': { $regex: search, $options: 'i' } },
    ];
  }

  // Execute query with pagination
  const [applications, total] = await Promise.all([
    User.find(query)
      .select('name email studentDetails createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    data: applications,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + applications.length < total,
    },
  };
};

/**
 * Review a student application (approve or reject)
 * @param {string} userId - The user ID to review
 * @param {string} action - The action to take ('approve' or 'reject')
 * @returns {Promise<Object>} Updated user with review status
 * @throws {Error} If user not found or application not pending
 */
export const reviewApplication = async (userId, action, actor, req) => {
  // Find the user
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  // Check if application is pending
  if (user.studentDetails.applicationStatus !== 'pending') {
    throw new Error('Application has already been reviewed');
  }

  // Update user based on action
  if (action === 'approve') {
    // Migrate to roles array
    user.roles = ['student'];
    user.studentDetails.applicationStatus = 'approved';
    user.studentDetails.isStudentVerified = true;

    // Send approval email (non-blocking)
    sendApprovalEmail(user).catch((error) => {
      console.error('Failed to send approval email:', error);
    });
  } else if (action === 'reject') {
    user.studentDetails.applicationStatus = 'rejected';
    user.studentDetails.usn = null;
    user.studentDetails.batch = null;
    user.studentDetails.section = null;
  }

  await user.save();

  // Log role change if approved
  try {
    if (action === 'approve') {
      await logAuthEvent({
        userId: user._id,
        actor: actor?.email || req?.user?.email || 'system',
        eventType: 'ROLE_CHANGED',
        severity: 'critical',
        context: { before: null, after: user.roles, changedBy: actor?.email || req?.user?.email || 'system' },
        req,
      });
      // Audit log for role change
      try {
        await logAudit({
          actor: actor || req?.user || null,
          action: 'ROLE_CHANGED',
          entityType: 'User',
          entityId: user._id,
          before: { roles: null },
          after: { roles: user.roles },
          req,
        });
      } catch (e) {
        // swallow
      }
    }
  } catch (e) {
    // swallow
  }

  return {
    message: `Application ${action}d successfully`,
    userId: user._id,
    roles: user.roles,
    applicationStatus: user.studentDetails.applicationStatus,
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Send approval email to student
 * @param {Object} user - The user object
 * @returns {Promise<void>}
 */
const sendApprovalEmail = async (user) => {
  const emailTemplate = await populateTemplate(
    'studentApplicationApproved.html',
    {
      name: user.name,
      loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
    }
  );

  await sendEmail({
    to: user.email,
    subject: 'Student Application Approved',
    html: emailTemplate,
  });
};
