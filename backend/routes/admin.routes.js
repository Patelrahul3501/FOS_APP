import express from 'express';
import { 
  getAdminSummary, 
  getAllUsers, 
  updateUser, 
  deleteUser, 
  getAttendanceLogs, 
  getExpenseLogs, 
  getUserRoute,
  updateAttendanceStatus, 
  deleteAttendance,
  updateExpenseAdmin, // Import new controller
  deleteExpenseAdmin  // Import new controller
} from '../controllers/admin.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/summary', protect, getAdminSummary);
router.get('/users', protect, getAllUsers);
router.put('/users/:id', protect, updateUser);
router.delete('/users/:id', protect, deleteUser);

router.get('/attendance-logs', protect, getAttendanceLogs);
router.get('/expense-logs', protect, getExpenseLogs);
router.get('/user-route', protect, getUserRoute);

router.put('/attendance-status/:id', protect, updateAttendanceStatus);
router.delete('/attendance/:id', protect, deleteAttendance);

// --- NEW EXPENSE MANAGEMENT ROUTES ---
router.put('/expenses/:id', protect, updateExpenseAdmin);
router.delete('/expenses/:id', protect, deleteExpenseAdmin);

export default router;