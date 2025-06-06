// import express from 'express';
// import { body, validationResult } from 'express-validator';
// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';

// const router = express.Router();

// // Register user
// router.post('/register', [
//   body('email').isEmail().normalizeEmail(),
//   body('password').isLength({ min: 6 })
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const { email, password } = req.body;

//     let user = await User.findOne({ email });
//     if (user) {
//       return res.status(400).json({ message: 'User already exists' });
//     }

//     user = new User({ email, password });
//     await user.save();

//     const token = jwt.sign(
//       { userId: user._id },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.status(201).json({ token });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Login user
// router.post('/login', [
//   body('email').isEmail().normalizeEmail(),
//   body('password').exists()
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const { email, password } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }

//     const token = jwt.sign(
//       { userId: user._id },
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' }
//     );

//     res.json({ token });
//   } catch (error) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// export default router; 