import Expense from '../models/Expense.js';

export const addExpense = async (req, res) => {
  try {
    const { title, amount } = req.body;
    const newExpense = new Expense({
      userId: req.user.id, // Populated from your auth middleware
      title,
      amount
    });
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1 });
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
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};