import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

/**
 * 1. CHECK-IN: Start the duty timer
 * Includes cleanup for forgotten punch-outs from previous days
 */
export const checkIn = async (req, res) => {
  try {
    const { location, selfie } = req.body;
    const userId = req.user._id;
    const today = new Date().toISOString().split('T')[0];

    // 1. Check for ANY 'In Progress' record regardless of date
    const staleRecord = await Attendance.findOne({ userId, status: 'In Progress' });
    
    if (staleRecord) {
      // If the stale record is from a previous day, auto-close it
      if (staleRecord.date !== today) {
        staleRecord.status = "Missed Punch Out";
        staleRecord.autoStopped = true;
        staleRecord.terminationReason = "User forgot to punch out yesterday";
        await staleRecord.save();
      } else {
        // If it's from today, they are already on duty
        return res.status(400).json({ success: false, message: 'Duty already started today' });
      }
    }

    // 2. Check if they already finished today's duty
    const existingToday = await Attendance.findOne({ userId, date: today });
    if (existingToday) {
      return res.status(400).json({ success: false, message: 'Duty already completed today' });
    }

    // 3. Create new record
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

    const record = await Attendance.findOne({ userId, date: today, status: 'In Progress' });

    if (!record) return res.status(400).json({ success: false, message: 'No active session found for today' });

    const outTime = new Date();
    const inTime = new Date(record.checkInTime);
    const diffInHrs = (outTime - inTime) / (1000 * 60 * 60);

    let finalStatus = 'Present';
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

    // Find today's record regardless of status (Terminated, Half Day, etc.)
    const record = await Attendance.findOne({ userId, date: today });

    if (!record) {
      return res.status(400).json({ success: false, message: "No record found for today." });
    }

    // BLOCK RESUME if the user has already completed the full shift (8.5 hours)
    // This matches your dashboard logic
    if (parseFloat(record.workHours) >= 8.5 || record.status === 'Present') {
      return res.status(400).json({ 
        success: false, 
        message: "Shift already completed. Cannot resume today." 
      });
    }

    // Resetting fields to put the user back "On Duty"
    record.checkOutTime = undefined;
    record.checkOutLocation = undefined;
    record.status = 'In Progress';
    record.workHours = "0"; // Reset so it recalculates correctly on next checkout
    record.autoStopped = false;
    record.terminationReason = null;
    
    await record.save();
    
    res.json({ 
      success: true, 
      message: "Duty resumed! You are back on track.",
      record: record 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. CHECK STATUS: Sync Dashboard UI
 * Automatically cleans up stale records from previous days
 */
export const checkStatus = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user._id;

    // Find today's specific record
    const record = await Attendance.findOne({ userId, date: today });
    
    if (record) {
      // If it's "In Progress" but from yesterday, close it
      if (record.date !== today && record.status === 'In Progress') {
        record.status = "Missed Punch Out";
        record.autoStopped = true;
        record.terminationReason = "User forgot to punch out";
        await record.save();
        return res.json({ exists: false });
      }

      // If it's today's record (Active, Terminated, or Completed)
      return res.json({ 
        exists: true,
        record: record // Frontend uses record.status and record.workHours
      });
    }

    res.json({ exists: false });
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
      historyMap[rec.date] = { 
        status: rec.status,
        checkInTime: rec.checkInTime,
        checkOutTime: rec.checkOutTime,
        workHours: rec.workHours,
        marked: true,
      };
    });

    res.status(200).json(historyMap);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching history" });
  }
};

/**
 * 6. STOP DUTY: Handle Compliance Violations and Logouts
 */
export const stopDuty = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // SAFETY FIX: Handle cases where req.body might be missing
    const body = req.body || {};
    const reason = body.reason;

    // SAFETY FIX: Ensure req.user exists from your auth middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const userId = req.user._id;

    // Look for the active record
    const record = await Attendance.findOne({ 
      userId: userId, 
      date: today, 
      status: 'In Progress' 
    });

    // If no record is found, it's not an "error" (500), just a "not found" (200 or 404)
    if (!record) {
      return res.status(200).json({ success: true, message: "No active duty found to stop." });
    }

    const outTime = new Date();
    const inTime = new Date(record.checkInTime);
    const diffInHrs = (outTime - inTime) / (1000 * 60 * 60);

    record.checkOutTime = outTime;
    record.workHours = diffInHrs.toFixed(2);
    record.autoStopped = true;

    if (reason === "Compliance Violation") {
      record.status = "Terminated";
      record.terminationReason = "Location Permission Revoked during shift";
    } else {
      if (diffInHrs < 4) {
        record.status = `${diffInHrs.toFixed(1)} Hours Worked`;
      } else if (diffInHrs < 8.5) {
        record.status = 'Half Day';
      } else {
        record.status = 'Present';
      }
    }

    await record.save();
    
    console.log(`Duty successfully stopped for ${userId}. Reason: ${reason || 'Manual'}`);

    res.status(200).json({ 
      success: true, 
      message: record.status === "Terminated" ? "Duty Terminated" : "Duty stopped." 
    });
  } catch (error) {
    // Log the actual error stack to your backend terminal for debugging
    console.error("CRITICAL ERROR IN STOP-DUTY:", error);
    res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
  }
};

/**
 * 7. UPDATE LOCATION: Live tracking pings
 */
export const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const userId = req.user._id;
    const today = new Date().toISOString().split('T')[0];

    // 1. Find the current record (including the last known location)
    const record = await Attendance.findOne({ userId, date: today, status: 'In Progress' });

    if (!record) {
      return res.status(404).json({ success: false, message: "No active session" });
    }

    // 2. Calculate Distance if a previous location exists
    let distanceIncrement = 0;
    if (record.lat && record.lng) {
      const R = 6371; // Earth's radius in KM
      const dLat = (lat - record.lat) * (Math.PI / 180);
      const dLng = (lng - record.lng) * (Math.PI / 180);
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(record.lat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceIncrement = R * c;
    }

    // 3. Update the record: Set current lat/lng, increment distance, and push to history
    await Attendance.updateOne(
      { _id: record._id },
      { 
        $set: { lat, lng },
        $inc: { distanceTraveled: distanceIncrement },
        $push: { routeHistory: { lat, lng, time: new Date() } }
      }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};