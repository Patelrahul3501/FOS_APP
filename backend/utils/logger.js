import Log from '../models/Log.js';

/**
 * Utility function to create an activity log in the database.
 * @param {String} userId - The ID of the user performing the action.
 * @param {String} action - The predefined action type (e.g. 'Punch In').
 * @param {String} details - A human-readable description of the log.
 */
export const logActivity = async (userId, action, details) => {
  try {
    if (!userId) return;
    const newLog = new Log({
      user: userId,
      action: action,
      details: details
    });
    await newLog.save();
  } catch (err) {
    console.error(`Failed to create log for user ${userId}:`, err.message);
  }
};
