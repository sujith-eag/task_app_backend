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

// Keep academic files for now (will be refactored in academics module)
import academicFileRoutes from '../api/files/academicFile.routes.js';

// College routes
import studentRoutes from '../api/college/student.routes.js';
import subjectRoutes from '../api/college/subject.routes.js';
import teacherRoutes from '../api/college/teacher.routes.js';

import tasksRoutes from '../api/tasks/routes/tasks.routes.js';

// ========================================
// NEW PHASE_0 ROUTES (REFACTORED)
// ========================================
// Add imports for refactored domain routes here as we create them

// Users module (refactored)
import usersRoutes from '../api/users/routes/users.routes.js';

// Auth module (refactored)
import authRoutes from '../api/auth/routes/auth.routes.js';

// Files module (refactored - Phase 0)
import filesRoutes from '../api/files/routes/file.routes.js';
import foldersRoutes from '../api/files/routes/folder.routes.js';

// Shares module (refactored - Phase 0)
import sharesRoutes from '../api/shares/routes/shares.routes.js';
import publicShareRoutes from '../api/shares/routes/public.routes.js';

// Trash module (refactored - Phase 0)
import trashRoutes from '../api/trash/routes/trash.routes.js';

// Chat module (refactored - Phase 0)
import chatRoutes from '../api/chat/routes/chat.routes.js';

// AI module (refactored - Phase 0)
import aiRoutes from '../api/ai/routes/ai.routes.js';

// Example future refactorings:
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
    
    // OLD FILE ROUTES - DEPRECATED (replaced by files_new, shares, trash modules)
    // These will be removed after testing new routes
    // app.use('/api/files/items', itemFileRoutes);
    // app.use('/api/files/uploads', uploadFileRoutes);
    // app.use('/api/files/downloads', downloadFileRoutes);
    // app.use('/api/files/shares', shareFileRoutes);
    // app.use('/api/files/delete', deleteFileRoutes);
    // app.use('/api/folders', folderRoutes);
    // app.use('/api/public/files', publicFileRoutes);
    
    // Keep academic files for now (will be refactored in academics module)
    app.use('/api/college/files', academicFileRoutes);
    
    // College management routes
    app.use('/api/college/students', studentRoutes);
    app.use('/api/college/subjects', subjectRoutes);
    app.use('/api/college/teachers', teacherRoutes);

    // ========================================
    // NEW PHASE_0 ROUTES (REFACTORED)
    // ========================================
    
    // Users module (refactored) ✅
    app.use('/api/users', usersRoutes);
    
    // Auth module (refactored) ✅
    app.use('/api/auth', authRoutes);
    
    // Files module (refactored) ✅
    app.use('/api/files', filesRoutes);        // Personal file operations
    app.use('/api/folders', foldersRoutes);    // Folder management
    
    // Shares module (refactored) ✅
    app.use('/api/shares', sharesRoutes);      // Authenticated sharing
    app.use('/api/public', publicShareRoutes); // Public access (no auth)
    
    // Trash module (refactored) ✅
    app.use('/api/trash', trashRoutes);        // Soft-delete & recovery
    
    // Chat module (refactored) ✅
    app.use('/api/chat', chatRoutes);          // Real-time messaging
    
    // AI module (refactored) ✅
    app.use('/api/ai', aiRoutes);              // AI-powered task generation
    
    // Tasks module (refactored) ✅
    app.use('/api/tasks', tasksRoutes);        // Task management
    
    // Mount additional refactored domain routes here as we create them
    // Example:
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
