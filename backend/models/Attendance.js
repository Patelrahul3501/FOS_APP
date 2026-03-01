import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { 
    type: String, 
    required: true 
  }, // Format: YYYY-MM-DD
  
  checkInTime: { type: Date },
  checkInLocation: { lat: Number, lng: Number },

  checkOutTime: { type: Date },
  checkOutLocation: { lat: Number, lng: Number },

  workHours: { 
    type: String, // Changed to String to store formatted "2.50"
    default: "0" 
  }, 
  
  selfie: String, 
  
  status: { 
    type: String, 
    // Removed ENUM to allow flexible strings like "0.5 hours worked"
    default: 'In Progress' 
  }
}, { timestamps: true });

export default mongoose.model('Attendance', attendanceSchema);