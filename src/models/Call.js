import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromNumber: {
    type: String,
    required: true
  },
  toNumber: {
    type: String,
    required: true
  },
  callControlId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['initiated', 'in-progress', 'completed', 'failed', 'cancelled'],
    default: 'initiated'
  },
  duration: {
    type: Number,
    default: 0
  },
  estimatedDuration: {
    type: Number,
    default: 0
  },
  unusedDuration: {
    type: Number,
    default: 0
  },
  cost: {
    type: Number,
    default: 0
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  paymentIntentId: {
    type: String
  },
  refundId: {
    type: String
  },
  isRefunded: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  telnyxWebhookData: {
    type: Object
  }
});

const Call = mongoose.model('Call', callSchema);

export default Call; 