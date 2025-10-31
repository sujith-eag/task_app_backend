import Subject from '../../../models/subjectModel.js';
import User from '../../../models/userModel.js';
import mongoose from 'mongoose';

/**
 * Subjects Controller (Phase 0 - Admin Domain)
 * 
 * Handles subject CRUD operations (administrative function)
 * Migrated from src/api/college/subject.controller.js
 */

class SubjectsController {
  /**
   * Create a new subject
   * POST /api/admin/subjects
   * Body: { name, subjectCode, semester, department }
   */
  async createSubject(req, res, next) {
    try {
      const { name, subjectCode, semester, department } = req.body;

      // Check if subject code already exists
      const existingSubject = await Subject.findOne({ subjectCode });
      
      if (existingSubject) {
        return res.status(400).json({
          success: false,
          message: `Subject with code ${subjectCode} already exists`
        });
      }

      // Create the subject
      const subject = await Subject.create({
        name,
        subjectCode,
        semester,
        department
      });

      res.status(201).json({
        success: true,
        message: 'Subject created successfully',
        data: { subject }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all subjects with optional filtering
   * GET /api/admin/subjects
   * Query: ?semester=5&department=CS
   */
  async getSubjects(req, res, next) {
    try {
      const { semester, department } = req.query;
      
      const filter = {};
      if (semester) filter.semester = parseInt(semester);
      if (department) filter.department = department;

      const subjects = await Subject.find(filter).sort({ semester: 1, name: 1 });

      res.status(200).json({
        success: true,
        data: { subjects, total: subjects.length }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single subject by ID
   * GET /api/admin/subjects/:id
   */
  async getSubjectById(req, res, next) {
    try {
      const { id } = req.params;

      const subject = await Subject.findById(id);

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: 'Subject not found'
        });
      }

      // Get usage statistics
      const teacherCount = await User.countDocuments({
        'teacherDetails.assignments.subject': subject._id
      });

      const studentCount = await User.countDocuments({
        'studentDetails.subjects': subject._id
      });

      res.status(200).json({
        success: true,
        data: {
          subject,
          usage: {
            teachers: teacherCount,
            students: studentCount
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a subject
   * PATCH /api/admin/subjects/:id
   * Body: { name, subjectCode, semester, department }
   */
  async updateSubject(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const { name, subjectCode, semester, department } = req.body;

      const subject = await Subject.findById(id).session(session);

      if (!subject) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Subject not found'
        });
      }

      const newSemester = semester;
      const semesterChanged = newSemester && newSemester !== subject.semester;

      // If semester is changing, remove all existing associations
      if (semesterChanged) {
        // Remove subject from all teacher assignments
        await User.updateMany(
          { 'teacherDetails.assignments.subject': subject._id },
          { $pull: { 'teacherDetails.assignments': { subject: subject._id } } }
        ).session(session);

        // Remove subject from all student enrollments
        await User.updateMany(
          { 'studentDetails.subjects': subject._id },
          { $pull: { 'studentDetails.subjects': subject._id } }
        ).session(session);
      }

      // Update subject fields
      if (name) subject.name = name;
      if (subjectCode) subject.subjectCode = subjectCode;
      if (semester) subject.semester = semester;
      if (department) subject.department = department;

      await subject.save({ session });

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: semesterChanged
          ? 'Subject updated successfully. All teacher and student associations have been removed due to semester change.'
          : 'Subject updated successfully',
        data: { subject }
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  }

  /**
   * Delete a subject
   * DELETE /api/admin/subjects/:id
   */
  async deleteSubject(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      const subject = await Subject.findById(id).session(session);

      if (!subject) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Subject not found'
        });
      }

      // Remove subject from all teacher assignments
      await User.updateMany(
        {},
        { $pull: { 'teacherDetails.assignments': { subject: subject._id } } }
      ).session(session);

      // Remove subject from all student enrollments
      await User.updateMany(
        { 'studentDetails.subjects': subject._id },
        { $pull: { 'studentDetails.subjects': subject._id } }
      ).session(session);

      // Delete the subject
      await subject.deleteOne({ session });

      await session.commitTransaction();

      res.status(200).json({
        success: true,
        message: 'Subject and all its associations removed successfully',
        data: { id }
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get subject usage statistics
   * GET /api/admin/subjects/:id/usage
   */
  async getSubjectUsage(req, res, next) {
    try {
      const { id } = req.params;

      const subject = await Subject.findById(id);

      if (!subject) {
        return res.status(404).json({
          success: false,
          message: 'Subject not found'
        });
      }

      // Get teachers teaching this subject
      const teachers = await User.find({
        'teacherDetails.assignments.subject': subject._id
      })
        .select('name email teacherDetails.assignments')
        .lean();

      const teacherAssignments = teachers.map(teacher => {
        const relevantAssignments = teacher.teacherDetails.assignments.filter(
          a => a.subject.toString() === id
        );
        return {
          teacherId: teacher._id,
          teacherName: teacher.name,
          teacherEmail: teacher.email,
          assignments: relevantAssignments
        };
      });

      // Get students enrolled in this subject
      const studentCount = await User.countDocuments({
        'studentDetails.subjects': subject._id
      });

      // Get students by batch/semester/section
      const studentDistribution = await User.aggregate([
        {
          $match: {
            'studentDetails.subjects': new mongoose.Types.ObjectId(id)
          }
        },
        {
          $group: {
            _id: {
              batch: '$studentDetails.batch',
              semester: '$studentDetails.semester',
              section: '$studentDetails.section'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.batch': -1, '_id.semester': 1, '_id.section': 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          subject: {
            _id: subject._id,
            name: subject.name,
            subjectCode: subject.subjectCode,
            semester: subject.semester,
            department: subject.department
          },
          teachers: teacherAssignments,
          totalTeachers: teachers.length,
          totalStudents: studentCount,
          studentDistribution
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new SubjectsController();
