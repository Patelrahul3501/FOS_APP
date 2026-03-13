import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, 
  checkInTime: { type: Date },
  checkInLocation: { lat: Number, lng: Number },
  
  // Latest position for the real-time map
  lat: { type: Number }, 
  lng: { type: Number },

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
  terminationReason: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model('Attendance', attendanceSchema);