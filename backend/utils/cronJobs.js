import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import { logActivity } from './logger.js';
// Auto-terminator: Runs every 1 minute to check for stale location syncs
// If no ping for > 6 minutes, terminate the session
cron.schedule('*/1 * * * *', async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sixMinsAgo = new Date(Date.now() - 6 * 60 * 1000);
    
    // Find all users who are currently 'In Progress' but haven't synced location in > 6 minutes
    const staleRecords = await Attendance.find({ 
      status: 'In Progress', 
      date: today,
      lastLocationSync: { $lt: sixMinsAgo }
    });

    for (let record of staleRecords) {
      const outTime = new Date();
      const inTime = new Date(record.checkInTime);
      const diffInHrs = (outTime - inTime) / (1000 * 60 * 60);

      record.checkOutTime = outTime;
      record.workHours = diffInHrs.toFixed(2);
      record.status = 'Terminated';
      record.terminationReason = 'App closed or Location Services disabled without punching out.';
      record.autoStopped = true;
      record.terminations.push({ time: outTime, reason: record.terminationReason });

      await record.save();
      // Log it
      await logActivity(record.userId, 'Terminated', `Background Monitor: Terminated session due to no location ping for > 6 minutes.`);
    }

    if (staleRecords.length > 0) {
      console.log(`🛡️  Security Monitor: Auto-terminated ${staleRecords.length} offline sessions.`);
    }
  } catch (err) {
    console.error('❌ Cron Job Error (Background Poller):', err);
  }
});

// Runs every day at 21:00 (9:00 PM)
cron.schedule('0 21 * * *', async () => {
  console.log('⏰ Running 9 PM Auto-Duty Stop Cron Job...');
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find all users who forgot to punch out
    const activeRecords = await Attendance.find({ 
      status: 'In Progress', 
      date: today 
    });

    for (let record of activeRecords) {
      const outTime = new Date(); // 9:00 PM
      const inTime = new Date(record.checkInTime);
      const diffInHrs = (outTime - inTime) / (1000 * 60 * 60);

      record.checkOutTime = outTime;
      record.workHours = diffInHrs.toFixed(2);
      // If they worked > 8.5 hrs by 9pm, they are present, else half-day
      record.status = diffInHrs >= 8.5 ? 'Present' : 'Half Day';
      record.autoStopped = true; // Flag to identify auto-stop in reports

      await record.save();
    }
    console.log(`✅ Automatically stopped ${activeRecords.length} duties.`);
  } catch (err) {
    console.error('❌ Cron Job Error:', err);
  }
}, {
  timezone: "Asia/Kolkata" // Change this to your specific timezone
});