import express from 'express';
import Stripe from 'stripe';
import twilio from 'twilio';
// import { AccessToken } from 'twilio/lib/jwt/AccessToken.js';
// import { VoiceGrant } from 'twilio/lib/jwt/AccessToken/VoiceGrant.js';
import { auth } from '../middleware/auth.js';
import Call from '../models/Call.js';
import User from '../models/User.js';
import twilioClient from '../services/twilio.js';
import AccessToken from 'twilio/lib/jwt/AccessToken.js';
import pkg from 'twilio/lib/jwt/AccessToken.js';
const { VoiceGrant } = pkg;

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Twilio client with proper credentials
const client = new twilio.Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Generate Twilio access token for client
// router.get('/token', async (req, res) => {
//   try {
//     const accessToken = new AccessToken(
//       process.env.TWILIO_ACCOUNT_SID,
//       process.env.TWILIO_API_KEY,
//       process.env.TWILIO_API_SECRET,
//       { identity: 'user' }
//     );

//     console.log("first", accessToken)

//     const voiceGrant = new VoiceGrant({
//       outgoingApplicationSid: process.env.TWILIO_APP_SID,
//       incomingAllow: true
//     });

//     accessToken.addGrant(voiceGrant);

//     res.json({
//       token: accessToken.toJwt()
//     });
//   } catch (error) {
//     console.error('Error generating token:', error);
//     res.status(500).json({ message: 'Error generating token', error: error.message });
//   }
// });

router.get('/token', async (req, res) => {
      // Add these headers to prevent ngrok interception
  res.header('ngrok-skip-browser-warning', 'true');
  res.header('Access-Control-Allow-Origin', '*');
    try {
      // Create an access token with credentials
      const token = new AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY,
        process.env.TWILIO_API_SECRET,
        { 
          identity: 'user', // You might want to make this dynamic
          ttl: 3600 // Token expiry time in seconds (1 hour)
        }
      );
  
      // Create a voice grant
      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: process.env.TWILIO_APP_SID,
        incomingAllow: true
      });
  
      // Add the grant to the token
      token.addGrant(voiceGrant);
  
      // Serialize the token to a JWT and return it
      const jwt = token.toJwt();
      
      res.json({
        token: jwt,
        identity: 'user' // Return the identity for client-side use
      });
  
    } catch (error) {
      console.error('Error generating token:', error);
      res.status(500).json({ 
        message: 'Error generating token', 
        error: error.message 
      });
    }
  });

// Voice endpoint for Twilio
router.post('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Get the 'To' number from the request parameters
  const toNumber = req.body.To || req.query.To;
  
  if (toNumber) {
    // Dial the number
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      record: 'record-from-answer',
      recordingStatusCallback: `${process.env.PUBLIC_URL}/api/calls/recording-status`
    });
    dial.number(toNumber);
  } else {
    // If no number is provided, say an error message
    twiml.say('Sorry, the number you are trying to reach is not available.');
  }
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// Public routes (no authentication required)
router.post('/public/initiate', async (req, res) => {
  try {
      console.log(req.body)
    const { toNumber, estimatedDuration, email } = req.body;

    // Find or create user by email
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ 
        email,
        type: 'public',
        balance: 100 // Default balance of $100
      });
      await user.save();
    }

    // Check if user has sufficient balance
    if (user.balance <= 0) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create Twilio call with a proper public URL
    const call = await twilioClient.calls.create({
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.PUBLIC_URL}/api/calls/voice`
    });

    // Create call record with estimated duration
    const callRecord = new Call({
      userId: user._id,
      fromNumber: process.env.TWILIO_PHONE_NUMBER,
      toNumber,
      callSid: call.sid,
      status: 'initiated',
      estimatedDuration: estimatedDuration || 0,
      paymentIntentId: req.body.paymentIntentId
    });

    await callRecord.save();

    res.json({ callSid: call.sid });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ message: 'Error initiating call', error: error.message });
  }
});

router.post('/public/end/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // End the call in Twilio
    await twilioClient.calls(callSid).update({ status: 'completed' });

    // Calculate actual duration and cost
    const actualDuration = Math.floor((Date.now() - call.startTime) / 1000);
    const actualCost = actualDuration * 0.01;

    // Calculate unused talktime and refund amount
    const unusedDuration = call.estimatedDuration - actualDuration;
    const refundAmount = unusedDuration > 0 ? unusedDuration * 0.01 : 0;

    // Update call record
    call.status = 'completed';
    call.duration = actualDuration;
    call.cost = actualCost;
    call.endTime = new Date();
    call.unusedDuration = unusedDuration;
    call.refundAmount = refundAmount;
    await call.save();

    // Update user balance
    user.balance -= actualCost;
    await user.save();

    // Process refund if there's unused talktime
    if (refundAmount > 0 && call.paymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: call.paymentIntentId,
          amount: Math.floor(refundAmount * 100)
        });

        user.balance += refundAmount;
        await user.save();

        call.isRefunded = true;
        call.refundId = refund.id;
        await call.save();
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
      }
    }

    res.json({ 
      message: 'Call ended successfully',
      actualDuration,
      actualCost,
      refundAmount,
      remainingBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error ending call' });
  }
});

router.post('/public/cancel/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.status === 'completed' || call.status === 'cancelled') {
      return res.status(400).json({ message: 'Call is already ended' });
    }

    // End the call in Twilio
    await twilioClient.calls(callSid).update({ status: 'completed' });

    // Calculate actual duration and cost
    const actualDuration = Math.floor((Date.now() - call.startTime) / 1000);
    const actualCost = actualDuration * 0.01;

    // Calculate refund amount
    const refundAmount = call.estimatedDuration * 0.01 - actualCost;

    // Update call record
    call.status = 'cancelled';
    call.duration = actualDuration;
    call.cost = actualCost;
    call.endTime = new Date();
    call.unusedDuration = call.estimatedDuration - actualDuration;
    call.refundAmount = refundAmount;
    await call.save();

    // Process refund
    if (refundAmount > 0 && call.paymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: call.paymentIntentId,
          amount: Math.floor(refundAmount * 100)
        });

        user.balance += refundAmount;
        await user.save();

        call.isRefunded = true;
        call.refundId = refund.id;
        await call.save();
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
      }
    }

    res.json({ 
      message: 'Call cancelled successfully',
      actualDuration,
      actualCost,
      refundAmount,
      remainingBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling call' });
  }
});

router.get('/public/status/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { email } = req.query;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    res.json(call);
  } catch (error) {
    res.status(500).json({ message: 'Error getting call status' });
  }
});

// Protected routes (authentication required)
router.post('/initiate', auth, async (req, res) => {
  try {
    const { toNumber, estimatedDuration } = req.body;
    const user = req.user;

    // Check if user has sufficient balance
    if (user.balance <= 0) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create Twilio call
    const call = await twilioClient.calls.create({
      to: toNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.BASE_URL}/api/calls/voice`
    });

    // Create call record with estimated duration
    const callRecord = new Call({
      userId: user._id,
      fromNumber: process.env.TWILIO_PHONE_NUMBER,
      toNumber,
      callSid: call.sid,
      status: 'initiated',
      estimatedDuration: estimatedDuration || 0,
      paymentIntentId: req.body.paymentIntentId
    });

    await callRecord.save();

    res.json({ callSid: call.sid });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ message: 'Error initiating call', error: error.message });
  }
});

// End a call
router.post('/end/:callSid', auth, async (req, res) => {
  try {
    const { callSid } = req.params;
    const user = req.user;

    // Update call status
    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // End the call in Twilio
    await client.calls(callSid).update({ status: 'completed' });

    // Calculate actual duration and cost
    const actualDuration = Math.floor((Date.now() - call.startTime) / 1000);
    const actualCost = actualDuration * 0.01; // $0.01 per second

    // Calculate unused talktime and refund amount
    const unusedDuration = call.estimatedDuration - actualDuration;
    const refundAmount = unusedDuration > 0 ? unusedDuration * 0.01 : 0;

    // Update call record
    call.status = 'completed';
    call.duration = actualDuration;
    call.cost = actualCost;
    call.endTime = new Date();
    call.unusedDuration = unusedDuration;
    call.refundAmount = refundAmount;
    await call.save();

    // Update user balance
    user.balance -= actualCost;
    await user.save();

    // Process refund if there's unused talktime
    if (refundAmount > 0 && call.paymentIntentId) {
      try {
        // Create refund through Stripe
        const refund = await stripe.refunds.create({
          payment_intent: call.paymentIntentId,
          amount: Math.floor(refundAmount * 100) // Convert to cents
        });

        // Update user balance with refund
        user.balance += refundAmount;
        await user.save();

        call.isRefunded = true;
        call.refundId = refund.id;
        await call.save();
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        // Continue with the response even if refund fails
      }
    }

    res.json({ 
      message: 'Call ended successfully',
      actualDuration,
      actualCost,
      refundAmount,
      remainingBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error ending call' });
  }
});

// Cancel a call
router.post('/cancel/:callSid', auth, async (req, res) => {
  try {
    const { callSid } = req.params;
    const user = req.user;

    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.status === 'completed' || call.status === 'cancelled') {
      return res.status(400).json({ message: 'Call is already ended' });
    }

    // End the call in Twilio
    await client.calls(callSid).update({ status: 'completed' });

    // Calculate actual duration and cost
    const actualDuration = Math.floor((Date.now() - call.startTime) / 1000);
    const actualCost = actualDuration * 0.01;

    // Calculate refund amount (full amount if call was just initiated)
    const refundAmount = call.estimatedDuration * 0.01 - actualCost;

    // Update call record
    call.status = 'cancelled';
    call.duration = actualDuration;
    call.cost = actualCost;
    call.endTime = new Date();
    call.unusedDuration = call.estimatedDuration - actualDuration;
    call.refundAmount = refundAmount;
    await call.save();

    // Process refund
    if (refundAmount > 0 && call.paymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: call.paymentIntentId,
          amount: Math.floor(refundAmount * 100)
        });

        user.balance += refundAmount;
        await user.save();

        call.isRefunded = true;
        call.refundId = refund.id;
        await call.save();
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
      }
    }

    res.json({ 
      message: 'Call cancelled successfully',
      actualDuration,
      actualCost,
      refundAmount,
      remainingBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling call' });
  }
});

// Get call status
router.get('/status/:callSid', auth, async (req, res) => {
  try {
    const { callSid } = req.params;
    const call = await Call.findOne({ callSid, userId: req.user._id });

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    res.json(call);
  } catch (error) {
    res.status(500).json({ message: 'Error getting call status' });
  }
});

export default router; 