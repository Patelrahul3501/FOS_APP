import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log(`Attempting login for: ${email}`);

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid Email or Password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid Email or Password' });

    // YOU ARE MISSING THIS PART:
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    console.log("✅ Result: Success! Token Generated");

    // Send the actual data back to the phone!
    return res.status(200).json({ 
      token, 
      role: user.role, 
      name: user.name 
    });

  } catch (error) {
    console.log("🔥 Server Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};


export const getProfile = async (req, res) => {
  try {
    // req.user.id comes from your 'protect' middleware
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};