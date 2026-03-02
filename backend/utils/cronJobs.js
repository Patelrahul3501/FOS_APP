import cron from 'node-cron';
import Attendance from '../models/Attendance.js';

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