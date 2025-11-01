import User from '../../../../models/userModel.js';
import Subject from '../../../../models/subjectModel.js';
import { populateTemplate } from '../../../../utils/emailTemplate.js';
import { sendEmail } from '../../../../services/email.service.js';
import { logAuthEvent } from '../../../auth/services/auth.log.service.js';

// ============================================================================
// User Management Services
// ============================================================================

/**
 * Get users by their role (verified only)
 * @param {string} role - The role to filter by ('user', 'student', 'teacher', 'hod')
 * @returns {Promise<Array>} List of users with the specified role
 */
export const getUsersByRole = async (role) => {
  const users = await User.find({
    roles: role,
    isVerified: true,
  }).select('name email studentDetails');

  return users;
};

/**
 * Get all users with the teacher or hod role
 * @returns {Promise<Array>} List of teachers and HODs with populated assignments
 */
export const getAllTeachers = async () => {
  const teachers = await User.find({ roles: { $in: ['teacher', 'hod'] } })
    .select('name email teacherDetails')
    .populate({
      path: 'teacherDetails.assignments.subject',
      select: 'name subjectCode',
    });

  return teachers;
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
