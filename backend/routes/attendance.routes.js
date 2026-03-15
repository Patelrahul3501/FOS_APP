import express from 'express';
import { getAdminSummary, getAllUsers, deleteUser } from '../controllers/admin.controller.js';
import { 
  checkStatus, 
  getAttendanceHistory, 
  checkIn, 
  checkOut ,
  resumeDuty,
  stopDuty,
  updateLocation,
  isHoliday
} from '../controllers/attendance.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin Routes
router.get('/summary', protect, getAdminSummary);
router.get('/users', protect, getAllUsers);
router.delete('/users/:id', protect, deleteUser);

// Attendance Flow Routes
router.post('/check-in', protect, checkIn);
router.post('/check-out', protect, checkOut);
router.get('/status', protect, checkStatus);
router.get('/history', protect, getAttendanceHistory);
router.get('/is-holiday', protect, isHoliday);

router.post('/update-location', protect, updateLocation);

router.post('/stop-duty', protect, stopDuty);

router.post('/resume', protect, resumeDuty);

export default router;