import express from 'express';
const router = express.Router();

// --- Import from refactored controllers ---
import { registerUser, loginUser } from '../controllers/authController.js';
import { 
    getCurrentUser, 
    updateCurrentUser, 
    changePassword 
    } from '../controllers/userController.js';
import { 
    forgotPassword, 
    resetPassword 
    } from '../controllers/passwordController.js';

// --- Import middleware ---
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';


// --- Authentication Routes (Public) ---
router.post('/', registerUser);
router.post('/login', loginUser);

// --- Password Reset Routes (Public) ---
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// --- User Profile Routes (Private) ---
router.route('/me')
    .get(protect, getCurrentUser)
    .put(protect, updateCurrentUser);

router.put('/password', protect, changePassword);


export default router;