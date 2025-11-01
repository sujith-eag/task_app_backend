import User from '../../../../models/userModel.js';
import Subject from '../../../../models/subjectModel.js';

// ============================================================================
// Teacher Assignment Services
// ============================================================================

/**
 * Add or update a teacher's subject assignments
 * @param {string} teacherId - The teacher's user ID
 * @param {Object} assignmentData - Assignment data (subject, sections, batch, semester)
 * @returns {Promise<Object>} Updated teacher with populated assignments
 * @throws {Error} If validation fails
 */
export const updateTeacherAssignments = async (teacherId, assignmentData) => {
  const { subject, sections, batch, semester } = assignmentData;

  // Validate that the subject exists before assigning it
  const subjectDoc = await Subject.findById(subject);
  if (!subjectDoc) {
    throw new Error('Invalid Subject ID. Subject does not exist.');
  }

  // Ensure the semester of the subject document matches the semester in the request
  if (subjectDoc.semester !== semester) {
    throw new Error(
      `Semester mismatch: The selected subject '${subjectDoc.name}' belongs to semester ${subjectDoc.semester}, not ${semester}.`
    );
  }

  // Find the teacher
  const teacher = await User.findById(teacherId);

  // Allow assigning subjects to both teachers and HODs
  if (!teacher || !(Array.isArray(teacher.roles) && (teacher.roles.includes('teacher') || teacher.roles.includes('hod')))) {
    throw new Error('Teacher not found.');
  }

  // Check for duplicate assignment
  const assignmentExists = teacher.teacherDetails.assignments.some(
    (assign) =>
      assign.subject.toString() === subject &&
      assign.batch === batch &&
      assign.semester === semester &&
      JSON.stringify(assign.sections.sort()) === JSON.stringify(sections.sort())
  );

  if (assignmentExists) {
    throw new Error('This exact assignment already exists for this teacher.');
  }

  // Add new assignment
  teacher.teacherDetails.assignments.push({
    subject,
    sections,
    batch,
    semester,
  });

  await teacher.save();

  // Populate the subject details for a more informative response
  const updatedTeacher = await User.findById(teacherId).populate({
    path: 'teacherDetails.assignments.subject',
    select: 'name subjectCode',
  });

  return {
    message: 'Teacher assignment updated successfully.',
    teacherDetails: updatedTeacher.teacherDetails,
  };
};

/**
 * Delete a teacher's subject assignment
 * @param {string} teacherId - The teacher's user ID
 * @param {string} assignmentId - The assignment subdocument ID
 * @returns {Promise<Object>} Success message
 * @throws {Error} If teacher or assignment not found
 */
export const deleteTeacherAssignment = async (teacherId, assignmentId) => {
  const teacher = await User.findById(teacherId);

  if (!teacher || !(Array.isArray(teacher.roles) && (teacher.roles.includes('teacher') || teacher.roles.includes('hod')))) {
    throw new Error('Faculty member not found.');
  }

  // Check if the assignment exists before trying to remove it
  const assignment = teacher.teacherDetails.assignments.id(assignmentId);
  if (!assignment) {
    throw new Error('Assignment not found for this faculty member.');
  }

  // Use the .pull() method to remove the subdocument by its _id
  teacher.teacherDetails.assignments.pull(assignmentId);

  await teacher.save();

  return {
    message: 'Assignment removed successfully.',
  };
};
