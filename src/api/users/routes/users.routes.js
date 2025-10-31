import express from 'express';
import { MulterError } from 'multer';

// Middleware
import { protect } from '../../_common/middleware/auth.middleware.js';
import { uploadAvatar } from '../../_common/middleware/file.middleware.js';

// Controllers
import * as usersController from '../controllers/users.controller.js';

// Validators
import { 
    validate, 
    updateProfileSchema, 
    changePasswordSchema,
    studentApplicationSchema 
} from '../validators/users.validators.js';

// Policies
import { isSelf, canApplyAsStudent, isVerified, isActive } from '../policies/users.policies.js';

const router = express.Router();

// Avatar upload error handler
// Catches Multer-specific errors before they reach the global error handler
const avatarErrorHandler = (err, req, res, next) => {
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
            message: 'Avatar image is too large. Maximum size is 5MB.' 
        });
    }
    next(err);
};

// =================================================================
// --- PRIVATE ROUTES (Require Authentication) ---
// =================================================================

// All routes below require authentication
router.use(protect);
router.use(isActive); // Ensure user account is active

// --- User Profile Routes ---
router.route('/me')
    .get(usersController.getCurrentUser)
    .put(
        validate(updateProfileSchema),
        usersController.updateProfile
    );

// --- Password Management ---
router.put('/password', 
    validate(changePasswordSchema),
    usersController.changePassword
);

// --- Avatar Management ---
router.put('/me/avatar',
    uploadAvatar, // Multer middleware for single image upload
    usersController.updateAvatar,
    avatarErrorHandler
);

// --- User Discovery ---
router.get('/discoverable', 
    isVerified, // Only verified users can discover others
    usersController.getDiscoverableUsers
);

// --- Student Application ---
router.post('/apply-student',
    canApplyAsStudent, // Check if user can apply
    validate(studentApplicationSchema),
    usersController.applyAsStudent
);

// --- Storage Information ---
router.get('/me/storage', 
    usersController.getStorageUsage
);

export default router;
