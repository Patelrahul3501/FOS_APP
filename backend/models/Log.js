import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'Punch In', 'Punch Out', 'Terminated', 'Resume Duty', 
      'Add Expense', 'Update Expense', 'Delete Expense', 
      'Update Profile', 'Delete Profile', 'Other'
    ]
  },
  details: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Optimize querying recent logs globally and by user
logSchema.index({ createdAt: -1 });
logSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Log', logSchema);
