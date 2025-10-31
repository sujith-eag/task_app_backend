/*
  Thin compatibility layer. The large admin controller was split into
  feature-specific controllers under `./controllers/`. 
  Importing and re-exporting the handlers here so existing imports continue to work.
*/

import * as applications from './controllers/applications.controller.js';
import * as management from './controllers/management.controller.js';
import * as assignments from './controllers/assignments.controller.js';
import * as reports from './controllers/reports.controller.js';

export { applications, management, assignments, reports };

// Also export individual named handlers used by routes for backward compatibility
export { getPendingApplications, reviewApplication } from './controllers/applications.controller.js';
export { getUsersByRole, updateStudentEnrollment, 
    promoteToFaculty, updateStudentDetails } from './controllers/management.controller.js';
export { updateTeacherAssignments, 
    deleteTeacherAssignment, getAllTeachers } from './controllers/assignments.controller.js';
export { getAttendanceStats, getFeedbackReport, 
    getFeedbackSummary, getTeacherReport, getStudentReport } from './controllers/reports.controller.js';
