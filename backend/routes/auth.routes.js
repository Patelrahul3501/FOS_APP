import express from 'express';
import { login, register, getProfile } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js'; // Ensure you have this middleware

const router = express.Router();

router.post('/login', login);
router.post('/register', register);

// This creates the /api/auth/me endpoint (assuming your prefix is /api/auth)
router.get('/me', protect, getProfile);

export default router;