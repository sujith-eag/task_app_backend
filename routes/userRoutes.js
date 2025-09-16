import express from 'express';
const router = express.Router();

import {
  registerUser,
  loginUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
    } from '../controllers/userController.js';

import { 
  protect, 
  authorizeRoles 
    } from '../middleware/authMiddleware.js';

    
// --- Authentication & User Routes ---
router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/current', protect, getCurrentUser);

// --- Password Reset Routes ---
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);


// Delete User Function Not yet Implemented
// router.delete('/admin/delete-user/:id', 
//   protect,
//   authorizeRoles('admin'),
//   deleteUserController
// );


export default router;