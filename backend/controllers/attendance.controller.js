import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

/**
 * 1. CHECK-IN: Start the duty timer
 */
export const checkIn = async (req, res) => {
  try {
    const { location, selfie } = req.body;
    const userId = req.user._id;
    const today = new Date().toISOString().split('T')[0];

    const existing = await Attendance.findOne({ userId, date: today });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Duty already started today' });
    }

    const newRecord = new Attendance({
      userId,
      date: today,
      checkInTime: new Date(),
      checkInLocation: { lat: location.lat, lng: location.lng },
      selfie: selfie,
      status: 'In Progress' 
    });

    await newRecord.save();
    res.status(201).json({ success: true, message: 'Check-in successful! Duty started.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. CHECK-OUT: Flexible timing with 8:30 logic
 */
export const checkOut = async (req, res) => {
  try {
    const { location, selfie } = req.body;
    const userId = req.user._id;
    const today = new Date().toISOString().split('T')[0];

    const record = await Attendance.findOne({ userId, date: today });

    if (!record) return res.status(400).json({ success: false, message: 'No Check-in found' });
    if (record.checkOutTime) return res.status(400).json({ success: false, message: 'Already checked out' });

    const outTime = new Date();
    const inTime = new Date(record.checkInTime);
    const diffInHrs = (outTime - inTime) / (1000 * 60 * 60);

    let finalStatus = 'Present';
    
    // Logic: 
    // < 4 hrs: Custom string (prevents validation error if enum is removed)
    // 4 to 8.5 hrs: Half Day
    // > 8.5 hrs: Present
    if (diffInHrs < 4) {
      finalStatus = `${diffInHrs.toFixed(1)} Hours Worked`;
    } else if (diffInHrs < 8.5) {
      finalStatus = 'Half Day';
    }

    record.checkOutTime = outTime;
    record.checkOutLocation = { lat: location.lat, lng: location.lng };
    record.status = finalStatus;
    record.workHours = diffInHrs.toFixed(2);
    record.selfie = selfie; 

    await record.save();

    res.status(200).json({ 
      success: true, 
      message: `Duty ended. Status: ${finalStatus}`,
      status: finalStatus 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. RESUME DUTY: Accidental Punch Out Recovery
 */
export const resumeDuty = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date().toISOString().split('T')[0];

    const record = await Attendance.findOne({ userId, date: today });

    if (!record || !record.checkOutTime) {
      return res.status(400).json({ message: "No active session to resume." });
    }

    // Reset checkout fields so user is "On Duty" again
    record.checkOutTime = undefined;
    record.checkOutLocation = undefined;
    record.status = 'In Progress';
    record.workHours = undefined;
    
    await record.save();
    res.json({ success: true, message: "Duty resumed! Timer is running." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 4. CHECK STATUS: Sync Dashboard UI
 */
export const checkStatus = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const record = await Attendance.findOne({ userId: req.user._id, date: today });
    
    if (!record) return res.json({ exists: false });

    // If checkIn exists but no checkOut, they are "In Progress"
    if (record.checkInTime && !record.checkOutTime) {
      return res.json({ 
        exists: true,
        record: {
          status: 'In Progress',
          checkInTime: record.checkInTime,
          selfie: record.selfie,
          checkInLocation: record.checkInLocation
        }
      });
    }

    // If fully checked out
    res.json({ 
      exists: true,
      record: {
        status: record.status,
        selfie: record.selfie,
        workHours: record.workHours,
        checkInTime: record.checkInTime
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 5. ATTENDANCE HISTORY
 */
export const getAttendanceHistory = async (req, res) => {
  try {
    const records = await Attendance.find({ userId: req.user._id });
    const historyMap = {};
    
    records.forEach(rec => {
      // We map the date string to the FULL record object
      // This ensures the frontend modal gets checkInTime, checkOutTime, and workHours
      historyMap[rec.date] = { 
        status: rec.status,
        checkInTime: rec.checkInTime,
        checkOutTime: rec.checkOutTime,
        workHours: rec.workHours,
        // Optional: Include markers here if you want to override frontend logic
        marked: true,
      };
    });

    res.status(200).json(historyMap);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching history" });
  }
};