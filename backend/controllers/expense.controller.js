import Expense from '../models/Expense.js';
import { logActivity } from '../utils/logger.js';

export const addExpense = async (req, res) => {
  try {
    const { title, amount } = req.body;
    const newExpense = new Expense({
      userId: req.user.id, // Populated from your auth middleware
      title,
      amount
    });
    await newExpense.save();
    
    // Log the action
    await logActivity(req.user.id, 'Add Expense', `Posted expense: ₹${amount} for ${title}`);
    
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyExpenses = async (req, res) => {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Limit to 60 days to prevent frontend from suffocating on massive payloads
    // O(1) query using the index with .lean() for zero Mongoose overhead
    const expenses = await Expense.find({ 
      userId: req.user.id,
      date: { $gte: sixtyDaysAgo }
    }).sort({ date: -1 }).lean();

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { title, amount } = req.body;
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title, amount },
      { new: true }
    );
    
    await logActivity(req.user.id, 'Update Expense', `Updated expense: ₹${amount} for ${title}`);
    
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if(expense) {
      await logActivity(req.user.id, 'Delete Expense', `Deleted expense: ₹${expense.amount} for ${expense.title}`);
    }
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};