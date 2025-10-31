/**
 * Central Route Registry
 * Mounts all domain routes with their base paths
 * 
 * This file acts as the single source of truth for all API routes.
 * As we refactor each domain, we'll add the new route mounts here.
 * Eventually, this will replace the individual route mounts in server.js.
 */

// ========================================
// LEGACY ROUTES (TO BE REFACTORED)
// ========================================
// These imports will be gradually replaced as we refactor each domain

import adminRoutes from '../api/admin/admin.routes.js';
import aiRoutes from '../api/ai/ai.routes.js';
import authRoutes from '../api/auth/auth.routes.js';
import conversationRoutes from '../api/chat/conversation.routes.js';

// File Routes (current structure)
import deleteFileRoutes from '../api/files/routes/delete.routes.js';
import downloadFileRoutes from '../api/files/routes/download.routes.js';
import itemFileRoutes from '../api/files/routes/item.routes.js';
import shareFileRoutes from '../api/files/routes/share.routes.js';
import uploadFileRoutes from '../api/files/routes/upload.routes.js';
import folderRoutes from '../api/files/folder.routes.js';
import publicFileRoutes from '../api/files/public.routes.js';
import academicFileRoutes from '../api/files/academicFile.routes.js';

// College routes
import studentRoutes from '../api/college/student.routes.js';
import subjectRoutes from '../api/college/subject.routes.js';
import teacherRoutes from '../api/college/teacher.routes.js';

import taskRoutes from '../api/tasks/task.routes.js';
import userRoutes from '../api/user/user.routes.js';

// ========================================
// NEW PHASE_0 ROUTES (REFACTORED)
// ========================================
// Add imports for refactored domain routes here as we create them
// Example:
// import filesRoutes from '../api/files/routes/file.routes.js';
// import sharesRoutes from '../api/shares/routes/shares.routes.js';
// import trashRoutes from '../api/trash/routes/trash.routes.js';
// import academicsRoutes from '../api/academics/routes/materials.routes.js';
// import assignmentsRoutes from '../api/assignments/routes/assignments.routes.js';
// import submissionsRoutes from '../api/assignments/routes/submissions.routes.js';
// import attendanceRoutes from '../api/attendance/routes/attendance.routes.js';

/**
 * Mount all routes to the Express app
 * 
 * @param {Express.Application} app - Express app instance
 */
export const mountRoutes = (app) => {
    // ========================================
    // LEGACY ROUTES (TO BE REFACTORED)
    // ========================================
    
    // Admin routes
    app.use('/api/admin', adminRoutes);
    
    // AI routes
    app.use('/api/ai', aiRoutes);
    
    // Auth routes
    app.use('/api/auth', authRoutes);
    
    // Chat/Messaging routes
    app.use('/api/chat', conversationRoutes);
    
    // File management routes (current structure)
    app.use('/api/files/items', itemFileRoutes);
    app.use('/api/files/uploads', uploadFileRoutes);
    app.use('/api/files/downloads', downloadFileRoutes);
    app.use('/api/files/shares', shareFileRoutes);
    app.use('/api/files/delete', deleteFileRoutes);
    app.use('/api/folders', folderRoutes);
    
    // Public and academic file routes
    app.use('/api/public/files', publicFileRoutes);
    app.use('/api/college/files', academicFileRoutes);
    
    // College management routes
    app.use('/api/college/students', studentRoutes);
    app.use('/api/college/subjects', subjectRoutes);
    app.use('/api/college/teachers', teacherRoutes);
    
    // Task management routes
    app.use('/api/tasks', taskRoutes);
    
    // User profile routes
    app.use('/api/users', userRoutes);

    // ========================================
    // NEW PHASE_0 ROUTES (REFACTORED)
    // ========================================
    // Mount refactored domain routes here as we create them
    // Example:
    // app.use('/api/files', filesRoutes);
    // app.use('/api/shares', sharesRoutes);
    // app.use('/api/trash', trashRoutes);
    // app.use('/api/academics', academicsRoutes);
    // app.use('/api/assignments', assignmentsRoutes);
    // app.use('/api/submissions', submissionsRoutes);
    // app.use('/api/attendance', attendanceRoutes);

    // 404 handler for undefined routes
    app.use((req, res) => {
        res.status(404).json({ 
            message: 'Route not found',
            path: req.path 
        });
    });
};

export default mountRoutes;
