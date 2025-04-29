import express from 'express';
import Stripe from 'stripe';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Public routes (no authentication required)
router.post('/public/make-payment', async (req, res) => {
    try {
        const { paymentMethodId, amount } = req.body
    
        // Create a payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          payment_method: paymentMethodId,
          amount: amount, // amount in cents
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          confirm: true,
        })
    
        // Return the client secret
        res.json({
          success: true,
          clientSecret: paymentIntent.client_secret,
        })
      } catch (error) {
        console.error("Payment error:", error)
        res.status(400).json({
          success: false,
          message: error.message || "Payment processing failed",
        })
      }
});

router.post('/public/create-payment-intent', async (req, res) => {
  try {
    const { amount, email } = req.body;

    // Find or create user by email
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, balance: 0 });
      await user.save();
    }

    // Create or get Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: 'Error creating payment intent' });
  }
});

router.post('/public/success', async (req, res) => {
  try {
    const { paymentIntentId, email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not successful' });
    }

    // Update user balance
    const amount = paymentIntent.amount / 100; // Convert from cents to dollars
    user.balance += amount;
    await user.save();

    res.json({ message: 'Payment successful', balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Error processing payment' });
  }
});

router.post('/public/refund/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the call
    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.isRefunded) {
      return res.status(400).json({ message: 'Call already refunded' });
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: call.paymentIntentId,
      amount: Math.floor(call.cost * 100) // Convert to cents
    });

    // Update call and user balance
    call.isRefunded = true;
    await call.save();

    user.balance += call.cost;
    await user.save();

    res.json({ message: 'Refund processed successfully', balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund' });
  }
});

// Protected routes (authentication required)
router.post('/create-payment-intent', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = req.user;

    // Create or get Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      customer: stripeCustomerId,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: 'Error creating payment intent' });
  }
});

// Handle successful payment
router.post('/success', auth, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const user = req.user;

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not successful' });
    }

    // Update user balance
    const amount = paymentIntent.amount / 100; // Convert from cents to dollars
    user.balance += amount;
    await user.save();

    res.json({ message: 'Payment successful', balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Error processing payment' });
  }
});

// Handle refund for cancelled call
router.post('/refund/:callSid', auth, async (req, res) => {
  try {
    const { callSid } = req.params;
    const user = req.user;

    // Find the call
    const call = await Call.findOne({ callSid, userId: user._id });
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.isRefunded) {
      return res.status(400).json({ message: 'Call already refunded' });
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: call.paymentIntentId,
      amount: Math.floor(call.cost * 100) // Convert to cents
    });

    // Update call and user balance
    call.isRefunded = true;
    await call.save();

    user.balance += call.cost;
    await user.save();

    res.json({ message: 'Refund processed successfully', balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund' });
  }
});

export default router; 