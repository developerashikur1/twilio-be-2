import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    minlength: 6,
    required: function() {
      return this.type === 'authenticated';
    },
    default: null
  },
  type: {
    type: String,
    enum: ['public', 'authenticated'],
    default: 'public'
  },
  balance: {
    type: Number,
    default: 100 // Default balance of $100
  },
  stripeCustomerId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving only if it's modified and user is authenticated
userSchema.pre('save', async function(next) {
  if (this.type === 'public' || !this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.type === 'public') return true;
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User; 