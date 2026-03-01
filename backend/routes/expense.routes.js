import express from 'express';
import { addExpense, getMyExpenses, updateExpense, deleteExpense } from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.middleware.js'; // Ensure you have this middleware

const router = express.Router();

router.post('/add', protect, addExpense);
router.get('/my', protect, getMyExpenses);
router.put('/:id', protect, updateExpense);
router.delete('/:id', protect, deleteExpense);

export default router;