import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  date: {
    type: String, // Expecting YYYY-MM-DD
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('Holiday', holidaySchema);
