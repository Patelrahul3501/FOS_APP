import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import adminRoutes from './routes/admin.routes.js';

import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import './utils/cronJobs.js';

dotenv.config();
const app = express();

// Production Middleware: Security & Speed
app.use(helmet()); 
app.use(compression());

// Instead of a global API block that breaks 30s background syncs, 
// we will apply standard limiters only to explicit routes to prevent abuse,
// while allowing the 'update-location' polling to fire freely.
const standardLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 1000, // 1000 requests per 15 minutes
  message: 'Too many requests, please try again later.' 
});

const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 120, // 120 requests per minute (2 per second) to allow live tracking
  message: 'Sync limit reached.'
});

const adminPollerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: 'Admin sync limit reached.'
});

// Apply sync limiter specifically to location tracking
app.use('/api/attendance/update-location', syncLimiter);
app.use('/api/admin/system-logs', adminPollerLimiter);
app.use('/api/admin/summary', adminPollerLimiter);

// Apply standard limiter broadly to all other /api routes
app.use('/api', standardLimiter);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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