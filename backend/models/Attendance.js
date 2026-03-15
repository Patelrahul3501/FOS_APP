import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, 
  checkInTime: { type: Date },
  checkInLocation: { lat: Number, lng: Number },
  
  // Latest position for the real-time map
  lat: { type: Number }, 
  lng: { type: Number },
  lastLocationSync: { type: Date, default: Date.now },

  // Full history for the Route page
  // We use select: false so it doesn't slow down the main dashboard fetch
  routeHistory: {
    type: [{
      lat: Number,
      lng: Number,
      time: { type: Date, default: Date.now }
    }],
    select: false 
  },
  
  distanceTraveled: { type: Number, default: 0 }, // Stored in KM
  checkOutTime: { type: Date },
  checkOutLocation: { lat: Number, lng: Number },
  workHours: { type: String, default: "0" }, 
  selfie: String, 
  status: { type: String, default: 'In Progress' },
  autoStopped: { type: Boolean, default: false },
  terminationReason: { type: String, default: null },

  // Track the history of every termination that occurs during a single day's duty
  terminations: [{
    time: { type: Date, default: Date.now },
    reason: { type: String }
  }]
}, { timestamps: true });

// Optimize lookups by User and Date for Admin/User dashboards
attendanceSchema.index({ userId: 1, date: -1 });

export default mongoose.model('Attendance', attendanceSchema);