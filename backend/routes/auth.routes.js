import express from 'express';
import { login, register, getProfile, updateProfilePhoto } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);

// This creates the /api/auth/me endpoint (assuming your prefix is /api/auth)
router.get('/me', protect, getProfile);
router.put('/profile-photo', protect, updateProfilePhoto);

export default router;