import asyncHandler from 'express-async-handler';
import Joi from 'joi';

import User from '../../../models/userModel.js';
import Subject from '../../../models/subjectModel.js';



// Joi Schema for adding/updating a teacher's subject assignment
const teacherAssignmentSchema = Joi.object({
    subject: Joi.string().hex().length(24).required(), // Subject ID
    sections: Joi.array().items(Joi.string()).min(1).required(), // e.g., ['A', 'B']
    batch: Joi.number().integer().required(),
    semester: Joi.number().integer().min(1).max(4).required()
});


// @desc    Add or update a teacher's subject assignments
// @route   POST /api/admin/teachers/:teacherId/assignments
// @access  Private/Admin
export const updateTeacherAssignments = asyncHandler(async (req, res) => {

    const { error, value } = teacherAssignmentSchema.validate(req.body);

    if (error) {
        res.status(400);
        throw new Error(error.details[0].message);
    }

    // Validate that the subject exists before assigning it    
    const subject = await Subject.findById(value.subject);
    if (!subject) {
        res.status(400);
        throw new Error('Invalid Subject ID. Subject does not exist.');
    }

    // Ensure the semester of the subject document matches the semester in the request
    if (subject.semester !== value.semester) {
        res.status(400);
        throw new Error(`Semester mismatch: The selected subject '${subject.name}' belongs to semester ${subject.semester}, not ${value.semester}.`);
    };


    const teacher = await User.findById(req.params.teacherId);

    // Allow assigning subjects to both teachers and HODs
    if (!teacher || !['teacher', 'hod'].includes(teacher.role)) {
        res.status(404);
        throw new Error('Teacher not found.');
    }

    // --- DUPLICATION CHECK ---
    const assignmentExists = teacher.teacherDetails.assignments.some(
        (assign) =>
            assign.subject.toString() === value.subject &&
            assign.batch === value.batch &&
            assign.semester === value.semester &&
            JSON.stringify(assign.sections.sort()) === JSON.stringify(value.sections.sort())
    );
    if (assignmentExists) {
        res.status(400);
        throw new Error('This exact assignment already exists for this teacher.');
    }

    // Adding a new assignment.
    teacher.teacherDetails.assignments.push(value);
    
    await teacher.save();

    // Populate the subject details for a more informative response
    const updatedTeacher = await User.findById(req.params.teacherId).populate({
        path: 'teacherDetails.assignments.subject',
        select: 'name subjectCode'
    });

    res.status(201).json({ // 201 for adding a new resource
        message: 'Teacher assignment updated successfully.',
        teacherDetails: updatedTeacher.teacherDetails,
    });
});


// @desc    Delete a teacher's subject assignment
// @route   DELETE /api/admin/teachers/:teacherId/assignments/:assignmentId
// @access  Private/Admin
export const deleteTeacherAssignment = asyncHandler(async (req, res) => {
    const { teacherId, assignmentId } = req.params;

    const teacher = await User.findById(teacherId);

    if (!teacher || !['teacher', 'hod'].includes(teacher.role)) {
        res.status(404);
        throw new Error('Faculty member not found.');
    }

    // Check if the assignment exists before trying to remove it
    const assignment = teacher.teacherDetails.assignments.id(assignmentId);
    if (!assignment) {
        res.status(404);
        throw new Error('Assignment not found for this faculty member.');
    }

    // Use the .pull() method to remove the subdocument by its _id    
    teacher.teacherDetails.assignments.pull(assignmentId);

    await teacher.save();

    res.status(200).json({
        message: 'Assignment removed successfully.',
    });
});


// @desc    Get all users with the teacher or hod role
// @route   GET /api/admin/teachers
// @access  Private/Admin
export const getAllTeachers = asyncHandler(async (req, res) => {
    const teachers = await User.find({ role: { $in: ['teacher', 'hod'] } })
        .select('name email teacherDetails')
        .populate({
            path: 'teacherDetails.assignments.subject',
            select: 'name subjectCode'
        });
    res.status(200).json(teachers);
});