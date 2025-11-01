import User from '../../../../models/userModel.js';
import { populateTemplate } from '../../../../utils/emailTemplate.js';
import { sendEmail } from '../../../../services/email.service.js';
import { logAuthEvent } from '../../../auth/services/auth.log.service.js';
import { logAudit } from '../../../_common/services/audit.service.js';

// ============================================================================
// Application Services
// ============================================================================

/**
 * Get all pending student applications
 * @returns {Promise<Array>} List of users with pending applications
 */
export const getPendingApplications = async () => {
  const pendingApplications = await User.find({
    'studentDetails.applicationStatus': 'pending',
  })
    .select('name email studentDetails')
    .lean();

  return pendingApplications;
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
