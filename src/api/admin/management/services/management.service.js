import User from '../../../../models/userModel.js';
import Subject from '../../../../models/subjectModel.js';
import { populateTemplate } from '../../../../utils/emailTemplate.js';
import { sendEmail } from '../../../../services/email.service.js';
import { logAuthEvent } from '../../../auth/services/auth.log.service.js';
import { logAudit } from '../../../_common/services/audit.service.js';
import sessionRegistry from '../../../_common/socket/sessionRegistry.js';

// ============================================================================
// User Management Services
// ============================================================================

/**
 * Get users by their role with pagination and search (verified only)
 * @param {string} role - The role to filter by ('user', 'student', 'teacher', 'hod')
 * @param {Object} options - Pagination and search options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.search=''] - Search term for name or email
 * @param {string} [options.sortBy='name'] - Field to sort by
 * @param {string} [options.sortOrder='asc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<Object>} Paginated users with metadata
 */
export const getUsersByRole = async (role, options = {}) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  const skip = (Math.max(1, page) - 1) * limit;

  // Build query
  const query = {
    roles: role,
    isVerified: true,
  };

  // Add search if provided
  if (search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { 'studentDetails.usn': { $regex: search, $options: 'i' } },
    ];
  }

  // Build sort
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  // Execute query with pagination
  const [users, total] = await Promise.all([
    User.find(query)
      .select('name email studentDetails')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    data: users,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + users.length < total,
    },
  };
};

/**
 * Get all users with the teacher or hod role with pagination
 * @param {Object} options - Pagination and search options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.search=''] - Search term for name, email, or staffId
 * @returns {Promise<Object>} Paginated teachers with metadata
 */
export const getAllTeachers = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    search = '',
  } = options;

  const skip = (Math.max(1, page) - 1) * limit;

  // Build query
  const query = { roles: { $in: ['teacher', 'hod'] } };

  // Add search if provided
  if (search.trim()) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { 'teacherDetails.staffId': { $regex: search, $options: 'i' } },
    ];
  }

  // Execute query with pagination
  const [teachers, total] = await Promise.all([
    User.find(query)
      .select('name email teacherDetails')
      .populate({
        path: 'teacherDetails.assignments.subject',
        select: 'name subjectCode',
      })
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  return {
    data: teachers,
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + teachers.length < total,
    },
  };
};

/**
 * Update a student's enrolled subjects
 * @param {string} studentId - The student's user ID
 * @param {Array<string>} subjectIds - Array of subject IDs to enroll
 * @returns {Promise<Object>} Updated enrollment information
 * @throws {Error} If validation fails
 */
export const updateStudentEnrollment = async (studentId, subjectIds) => {
  const student = await User.findById(studentId);

  if (!student || !(Array.isArray(student.roles) && student.roles.includes('student'))) {
    throw new Error('Student not found.');
  }

  // Validate subjects match student's semester
  if (subjectIds.length > 0) {
    const studentSemester = student.studentDetails.semester;
    if (!studentSemester) {
      throw new Error(
        'Cannot enroll subjects for a student with no assigned semester.'
      );
    }

    const subjectsToEnroll = await Subject.find({
      _id: { $in: subjectIds },
    });

    // Ensure all found subjects match the student's semester
    const allSubjectsMatchSemester = subjectsToEnroll.every(
      (subject) => subject.semester === studentSemester
    );

    if (!allSubjectsMatchSemester) {
      throw new Error(
        "One or more subjects do not match the student's current semester."
      );
    }
  }

  // Replace the existing enrolled subjects with the new array
  student.studentDetails.enrolledSubjects = subjectIds;

  await student.save();

  return {
    message: 'Student enrollment updated successfully.',
    enrolledSubjects: student.studentDetails.enrolledSubjects,
  };
};

/**
 * Promote a user to a faculty role (teacher/hod)
 * @param {string} userId - The user's ID
 * @param {Object} promotionData - Promotion data (role, staffId, department)
 * @returns {Promise<Object>} Updated user information
 * @throws {Error} If validation fails
 */
export const promoteToFaculty = async (userId, promotionData, actor, req) => {
  const { role, staffId, department } = promotionData;

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User not found.');
  }

  // Check if staffId is already in use
  const staffIdExists = await User.findOne({ 'teacherDetails.staffId': staffId });
  if (staffIdExists && staffIdExists._id.toString() !== user._id.toString()) {
    throw new Error('This Staff ID is already assigned to another user.');
  }

  const beforeRoles = Array.isArray(user.roles) ? user.roles.slice() : [];

  // Normalize incoming role into roles array
  user.roles = Array.isArray(role) ? role : [role];
  user.teacherDetails = {
    staffId,
    department,
    assignments: [],
  };

  // Clear student data if they were a student before promotion
  user.studentDetails = {
    applicationStatus: 'not_applied',
  };

  await user.save();

  // Send promotion email (non-blocking)
  sendPromotionEmail(user, role).catch((error) => {
    console.error('Failed to send promotion email:', error);
  });

  // Log role change
  try {
    await logAuthEvent({
      userId: user._id,
      actor: actor?.email || (req?.user?.email) || 'system',
      eventType: 'ROLE_CHANGED',
      severity: 'critical',
      context: { before: beforeRoles, after: user.roles, changedBy: actor?.email || req?.user?.email || 'system' },
      req,
    });
  } catch (e) {
    // swallow logging errors
  }
  
    // Also write an AuditLog entry for the role change (structured, with before/after)
    try {
      await logAudit({
        actor: actor || req?.user || null,
        action: 'ROLE_CHANGED',
        entityType: 'User',
        entityId: user._id,
        before: { roles: beforeRoles },
        after: { roles: user.roles },
        req,
      });
    } catch (e) {
      // swallow audit errors
    }

  return {
    message: `${user.name} has been promoted to ${role}.`,
    user: {
      id: user._id,
      roles: user.roles,
      teacherDetails: user.teacherDetails,
    },
  };
};

/**
 * Update a student's details by an admin
 * @param {string} studentId - The student's user ID
 * @param {Object} updateData - Data to update (usn, batch, section, semester)
 * @returns {Promise<Object>} Updated student details
 * @throws {Error} If validation fails
 */
export const updateStudentDetails = async (studentId, updateData) => {
  const student = await User.findById(studentId);

  if (!student || !(Array.isArray(student.roles) && student.roles.includes('student'))) {
    throw new Error('Student not found.');
  }

  // If semester is being changed, wipe existing enrollments
  const newSemester = updateData.semester;
  const currentSemester = student.studentDetails.semester;
  if (newSemester && newSemester !== currentSemester) {
    student.studentDetails.enrolledSubjects = [];
  }

  // Update only the provided details
  Object.assign(student.studentDetails, updateData);

  await student.save();

  return {
    message: 'Student details updated successfully.',
    studentDetails: student.studentDetails,
  };
};

/**
 * List all sessions across users (admin)
 * Supports pagination and simple filters (deviceId, ip, email, role)
 */
export const listAllSessions = async ({ page = 1, limit = 20, deviceId, ip, email, role }) => {
  const skip = (Math.max(1, page) - 1) * limit;

  const match = {};
  if (deviceId) match['sessions.deviceId'] = deviceId;
  if (ip) match['sessions.ipAddress'] = { $regex: ip, $options: 'i' };
  if (email) match['email'] = { $regex: email, $options: 'i' };
  if (role) match['roles'] = role;

  const pipeline = [
    { $unwind: '$sessions' },
    { $match: match },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: '$name',
        email: '$email',
        roles: '$roles',
        session: '$sessions',
      },
    },
    { $sort: { 'session.lastUsedAt': -1 } },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const result = await User.aggregate(pipeline).allowDiskUse(true);
  const metadata = (result[0].metadata[0] && result[0].metadata[0].total) || 0;
  const data = result[0].data || [];

  // Enrich with active flag from in-memory session registry
  const enriched = data.map((row) => {
    const isActive = sessionRegistry.isDeviceActive(row.userId.toString(), row.session.deviceId);
    return {
      userId: row.userId,
      name: row.name,
      email: row.email,
      roles: row.roles,
      deviceId: row.session.deviceId,
      ipAddress: row.session.ipAddress,
      userAgent: row.session.userAgent,
      createdAt: row.session.createdAt,
      lastUsedAt: row.session.lastUsedAt,
      isActive,
    };
  });

  return {
    total: metadata,
    page: Math.max(1, page),
    pageSize: limit,
    data: enriched,
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Send promotion email to faculty member
 * @param {Object} user - The user object
 * @param {string} role - The new role
 * @returns {Promise<void>}
 */
const sendPromotionEmail = async (user, role) => {
  const templateData = {
    name: user.name,
    newRole: role,
    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
  };

  const htmlMessage = await populateTemplate('facultyPromotion.html', templateData);

  await sendEmail({
    to: user.email,
    subject: 'Your Account Role has been Updated',
    html: htmlMessage,
    text: `Hello ${user.name}, your account has been promoted to the ${role} role.`,
  });
};
