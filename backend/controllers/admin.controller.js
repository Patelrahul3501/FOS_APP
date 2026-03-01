import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Expense from '../models/Expense.js';

/**
 * 1. ADMIN SUMMARY
 * Fetches dashboard stats and active officer cards including 
 * real-time expenses, check-in/out times, and work hours.
 */
export const getAdminSummary = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const today = new Date().toISOString().split('T')[0];

    // Find all attendance records for today
    const activeAttendance = await Attendance.find({ date: today })
      .populate('userId', 'name email phone') 
      .select('checkInLocation checkInTime checkOutTime workHours userId selfie status');

    // Use Promise.all to fetch expenses for each user in parallel
    const activeLocations = await Promise.all(activeAttendance.map(async (item) => {
      // Find expenses for this user today
      const dailyExpenses = await Expense.find({ 
        userId: item.userId?._id, 
        date: { 
          $gte: new Date(today), 
          $lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000) 
        }
      });
      
      const totalSpent = dailyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      return {
        _id: item.userId?._id,
        attendanceId: item._id, 
        name: item.userId?.name || 'Unknown Officer',
        phone: item.userId?.phone || '', 
        lat: item.checkInLocation?.lat,
        lng: item.checkInLocation?.lng,
        selfie: item.selfie,
        checkInTime: item.checkInTime,
        checkOutTime: item.checkOutTime || null, 
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
      .sort({ date: -1 });

    res.json(logs);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

/**
 * 5. USER MANAGEMENT
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password');
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
    res.json({ message: "User updated successfully" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
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
    const logs = await Expense.find(query).populate('userId', 'name phone').sort({ date: -1 });
    res.json(logs);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getUserRoute = async (req, res) => {
  try {
    const { userId, date } = req.query;
    const filterDate = date || new Date().toISOString().split('T')[0];
    const points = await Attendance.find({ userId, date: filterDate }).sort({ timestamp: 1 }).select('checkInLocation');
    const coordinates = points.map(p => ({ 
      latitude: p.checkInLocation.lat, 
      longitude: p.checkInLocation.lng 
    }));
    res.json(coordinates);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const deleteAttendance = async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: "Attendance record deleted" });
  } catch (error) { res.status(500).json({ message: error.message }); }
};