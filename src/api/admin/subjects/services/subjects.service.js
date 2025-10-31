import Subject from '../../../../models/subjectModel.js';
import User from '../../../../models/userModel.js';

// ============================================================================
// Subject Services
// ============================================================================

/**
 * Create a new subject
 * @param {Object} subjectData - Subject data (name, subjectCode, semester, department)
 * @returns {Promise<Object>} Created subject
 * @throws {Error} If subject code already exists
 */
export const createSubject = async (subjectData) => {
  const { name, subjectCode, semester, department } = subjectData;

  // Check if subject code already exists
  const subjectExists = await Subject.findOne({ subjectCode });
  if (subjectExists) {
    throw new Error(`Subject with code ${subjectCode} already exists.`);
  }

  // Create the subject
  const subject = await Subject.create({
    name,
    subjectCode,
    semester,
    department,
  });

  return subject;
};

/**
 * Get all subjects with optional semester filter
 * @param {Object} filters - Filter options (semester)
 * @returns {Promise<Array>} List of subjects
 */
export const getSubjects = async (filters = {}) => {
  const query = {};

  if (filters.semester) {
    query.semester = filters.semester;
  }

  const subjects = await Subject.find(query);
  return subjects;
};

/**
 * Get a single subject by ID
 * @param {string} subjectId - The subject's ID
 * @returns {Promise<Object>} Subject document
 * @throws {Error} If subject not found
 */
export const getSubjectById = async (subjectId) => {
  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new Error('Subject not found.');
  }

  return subject;
};

/**
 * Update a subject
 * @param {string} subjectId - The subject's ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated subject
 * @throws {Error} If subject not found
 */
export const updateSubject = async (subjectId, updateData) => {
  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new Error('Subject not found.');
  }

  const newSemester = updateData.semester;

  // If the semester is being changed, we must remove all existing associations
  if (newSemester && newSemester !== subject.semester) {
    // Remove subject from all teacher assignments
    await User.updateMany(
      { 'teacherDetails.assignments.subject': subject._id },
      { $pull: { 'teacherDetails.assignments': { subject: subject._id } } }
    );

    // Remove subject from all student enrollments
    await User.updateMany(
      { 'studentDetails.enrolledSubjects': subject._id },
      { $pull: { 'studentDetails.enrolledSubjects': subject._id } }
    );
  }

  // Update subject fields
  subject.name = updateData.name || subject.name;
  subject.subjectCode = updateData.subjectCode || subject.subjectCode;
  subject.semester = updateData.semester || subject.semester;
  subject.department = updateData.department || subject.department;

  const updatedSubject = await subject.save();
  return updatedSubject;
};

/**
 * Delete a subject and all its associations
 * @param {string} subjectId - The subject's ID
 * @returns {Promise<Object>} Success message with subject ID
 * @throws {Error} If subject not found
 */
export const deleteSubject = async (subjectId) => {
  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new Error('Subject not found.');
  }

  // Before deleting the subject, remove any teacher assignments that reference it
  await User.updateMany(
    {},
    { $pull: { 'teacherDetails.assignments': { subject: subject._id } } }
  );

  // Remove subject from all student enrollments
  await User.updateMany(
    { 'studentDetails.enrolledSubjects': subject._id },
    { $pull: { 'studentDetails.enrolledSubjects': subject._id } }
  );

  // Delete the subject
  await subject.deleteOne();

  return {
    id: subjectId,
    message: 'Subject and all its associations removed successfully.',
  };
};
