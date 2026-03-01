import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB for seeding...");

    // 2. Clear existing users to avoid "Email already exists" errors
    await User.deleteMany({});
    console.log("🗑️ Old users cleared.");

    // 3. Hash Passwords
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("123456", salt);

    // 4. Create Data
    const users = [
      {
        name: "Admin Rahul",
        email: "admin@test.com",
        password: hashedPassword,
        role: "admin"
      },
      {
        name: "Officer Aman",
        email: "user@test.com",
        password: hashedPassword,
        role: "user"
      }
    ];

    // 5. Insert into DB
    await User.insertMany(users);
    console.log("👥 Database Seeded! You can now login with:");
    console.log("📧 Email: admin@test.com | 🔑 Pass: 123456");
    console.log("📧 Email: user@test.com  | 🔑 Pass: 123456");

    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedDatabase();