import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Expense from '../models/Expense.js';
import Log from '../models/Log.js';
import Holiday from '../models/Holiday.js';
import { logActivity } from '../utils/logger.js';

/**
 * 1. ADMIN SUMMARY
 * Fetches dashboard stats and active officer cards including 
 * real-time expenses, check-in/out times, and work hours.
 */
export const getAdminSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const today = new Date().toISOString().split('T')[0];

    // 1. Find all attendance records for today
    const activeAttendance = await Attendance.find({ date: today })
      .populate('userId', 'name email phone') 
      .select('checkInLocation checkInTime checkOutTime workHours userId selfie status lat lng updatedAt')
      .lean();

    // 2. Fetch expenses in parallel
    const activeLocations = await Promise.all(activeAttendance.map(async (item) => {
      const dailyExpenses = await Expense.find({ 
        userId: item.userId?._id, 
        date: { 
          $gte: new Date(today), 
          $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000) 
        }
      }).lean();
      
      const totalSpent = dailyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      return {
        _id: item.userId?._id,
        attendanceId: item._id, 
        name: item.userId?.name || 'Unknown Officer',
        phone: item.userId?.phone || '', 
        // FIX: Use the live tracking lat/lng if they exist, fallback to check-in location
        lat: item.lat || item.checkInLocation?.lat,
        lng: item.lng || item.checkInLocation?.lng,
        selfie: item.selfie,
        checkInTime: item.checkInTime,
        checkOutTime: item.checkOutTime || null, 
        // FIX: Send updatedAt so the Admin Dashboard can show the real "Last Seen" time
        updatedAt: item.updatedAt || item.checkInTime,
        workHours: item.workHours || "0.00",
        status: item.status,
        todayExpense: totalSpent,
        isOnline: true 
      };
    }));

    res.status(200).json({
      stats: { total: totalUsers, present: activeAttendance.length },
      activeLocations
    });
  } catch (error) { 
    res.status(500).json({ message: error.message }); 
  }
};

/**
 * 2. UPDATE ATTENDANCE STATUS
 * Allows admin to manually override status via modal
 */
export const updateAttendanceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Attendance.findByIdAndUpdate(
      req.params.id, 
      { status: status }, 
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    res.json({ success: true, updated });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
};

/**
 * 3. EXPENSE MANAGEMENT (NEW)
 * Admin can edit and delete expense records
 */
export const updateExpenseAdmin = async (req, res) => {
  try {
    const { title, amount } = req.body;
    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { title, amount: Number(amount) },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Expense not found" });
    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteExpenseAdmin = async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Expense not found" });
    res.json({ success: true, message: "Expense removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. ATTENDANCE LOGS
 */
export const getAttendanceLogs = async (req, res) => {
  try {
    const { userId, start, end } = req.query;
    let query = {};
    if (userId && userId !== '') query.userId = userId;
    if (start && end) { query.date = { $gte: start, $lte: end }; }

    const logs = await Attendance.find(query)
      .populate('userId', 'name email phone') 
      .select('userId date checkInTime checkOutTime checkInLocation selfie status workHours') 
      .sort({ date: -1 })
      .limit(300)
      .lean();

    res.json(logs);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 5. USER MANAGEMENT
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').lean();
    res.json(users);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (password && password.trim() !== "") { user.password = password; }
    
    await user.save();
    
    // Log the action (Admin updating an officer profile)
    await logActivity(req.user.id, 'Update Profile', `Admin updated profile for user: ${user.name}`);
    
    res.json({ message: "User updated successfully" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if(user) {
        await User.findByIdAndDelete(req.params.id);
        await logActivity(req.user.id, 'Delete Profile', `Admin deleted user profile: ${user.name}`);
    }
    res.json({ message: "User removed successfully" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 6. EXPENSE & ROUTE LOGS
 */
export const getExpenseLogs = async (req, res) => {
  try {
    const { userId, start, end } = req.query;
    let query = {};
    if (userId && userId !== '') { query.userId = userId; }
    if (start && end) {
      query.date = { 
        $gte: new Date(start), 
        $lte: new Date(new Date(end).setHours(23, 59, 59)) 
      };
    }
    const logs = await Expense.find(query).populate('userId', 'name phone').sort({ date: -1 }).limit(300).lean();
    res.json(logs);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getUserRoute = async (req, res) => {
  try {
    const { userId, date } = req.query;

    const record = await Attendance.findOne({ userId, date })
      .select('+routeHistory'); // Manually include the hidden history field

    if (!record) {
      return res.status(404).json({ message: "No route data found" });
    }

    // Map data for Frontend (Polyline expects latitude/longitude)
    const coordinates = record.routeHistory.map(p => ({
      latitude: p.lat,
      longitude: p.lng,
      time: p.time
    }));

    res.json({
      coordinates,
      totalDistance: record.distanceTraveled.toFixed(2),
      start: record.checkInTime,
      end: record.updatedAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: "Attendance record deleted" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 7. SYSTEM LOGS
 */
export const getSystemLogs = async (req, res) => {
  try {
    const { userId, start, end } = req.query;
    let query = {};
    
    if (userId && userId !== '') {
      query.user = userId;
    }
    
    // Default to today if no dates provided
    const todayStr = new Date().toISOString().split('T')[0];
    const startDate = start ? new Date(start) : new Date(todayStr);
    const endDate = end ? new Date(new Date(end).setHours(23, 59, 59)) : new Date(new Date(todayStr).setHours(23, 59, 59));
    
    query.createdAt = {
      $gte: startDate,
      $lte: endDate
    };

    const logs = await Log.find(query)
      .populate('user', 'name phone')
      .sort({ createdAt: -1 })
      .limit(200) // Increased limit as they might filter a large range
      .lean();
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteSystemLog = async (req, res) => {
  try {
    await Log.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Log removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 8. HOLIDAY MANAGEMENT
 */
export const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addHoliday = async (req, res) => {
  try {
    const { date, name } = req.body;
    const newHoliday = new Holiday({ date, name });
    await newHoliday.save();
    res.status(201).json(newHoliday);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Holiday already exists for this date" });
    res.status(500).json({ message: error.message });
  }
};

export const deleteHoliday = async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Holiday removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};