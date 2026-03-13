import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import adminRoutes from './routes/admin.routes.js';

import './utils/cronJobs.js';

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increased limit for selfie uploads

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/admin', adminRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0',() => console.log(`🚀 Server running on port ${PORT}`));