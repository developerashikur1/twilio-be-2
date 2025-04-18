import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errorHandler.js';
import callRoutes from './routes/calls.js';
// import authRoutes from './routes/auth.js';
// import paymentRoutes from './routes/payments.js';

// Debug logging for environment variables
// console.log('Environment variables loaded:');
// console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Present' : 'Missing');
// console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');
// console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'Present' : 'Missing');
// console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Present' : 'Missing');
// console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? 'Present' : 'Missing');
// console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Present' : 'Missing');
// console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY ? 'Present' : 'Missing');

// Set default PUBLIC_URL for development
if (!process.env.PUBLIC_URL) {
  process.env.PUBLIC_URL = 'https://twilio-be-2-snjr.onrender.com';
  console.log('Using default PUBLIC_URL:', process.env.PUBLIC_URL);
}

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

const app = express();

// Middleware
  
const allowedOrigins = [
    'https://e-phone-v1.netlify.app',
    'https://twilio-be-2-snjr.onrender.com',
    'https://your-frontend-domain.com',
    'http://localhost:5173',
  ];
  
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning']
  }));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio webhooks

// Basic route to check if server is running
app.get('/', (req, res) => {
  res.json({ message: 'Twilio Backend API is running' });
});

// Routes
// app.use('/api/auth', authRoutes);
app.use('/api/calls', callRoutes);
// app.use('/api/payments', paymentRoutes);

// Error handling
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
}); 