import express from 'express';
import Stripe from 'stripe';
import Call from '../models/Call.js';
import User from '../models/User.js';
import telnyxClient from '../services/telnyx.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Public routes (no authentication required)
router.post('/public/initiate', async (req, res) => {
    try {
        const { toNumber, estimatedDuration, email } = req.body;

        // Create Telnyx call
        const call = await telnyxClient.calls.create({
            connection_id: process.env.TELNYX_CONNECTION_ID,
            to: toNumber,
            from: process.env.TELNYX_PHONE_NUMBER,
            webhook_url: `${process.env.PUBLIC_URL}/api/calls/webhook`,
            webhook_url_method: 'POST'
        });

        // Create call record
        // const callRecord = new Call({
        //     userId: "user._id",
        //     fromNumber: process.env.TELNYX_PHONE_NUMBER,
        //     toNumber,
        //     callControlId: call.data.id,
        //     status: 'initiated',
        //     estimatedDuration: estimatedDuration || 0,
        //     paymentIntentId: req.body.paymentIntentId
        // });

        // await callRecord.save();

        res.json({ callControlId: call.data.id });
    } catch (error) {
        console.error('Error initiating call:', error);
        res.status(500).json({ message: 'Error initiating call', error: error.message });
    }
});

// Webhook handler for Telnyx call events
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;
        const callControlId = event.data.payload.call_control_id;

        const call = await Call.findOne({ callControlId });
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }

        // Update call status based on event type
        switch (event.data.event_type) {
            case 'call.initiated':
                call.status = 'initiated';
                break;
            case 'call.answered':
                call.status = 'in-progress';
                break;
            case 'call.hangup':
                call.status = 'completed';
                call.endTime = new Date();
                call.duration = event.data.payload.duration_seconds || 0;
                break;
            case 'call.failed':
                call.status = 'failed';
                break;
        }

        // Store webhook data
        call.telnyxWebhookData = event.data;
        await call.save();

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ message: 'Error processing webhook' });
    }
});

router.post('/public/end/:callControlId', async (req, res) => {
    try {
        const { callControlId } = req.params;

        const call = await Call.findOne({ callControlId });
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }

        // End the call in Telnyx
        await telnyxClient.calls.hangup(callControlId);

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

        // Process refund if there's unused talktime
        if (refundAmount > 0 && call.paymentIntentId) {
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: call.paymentIntentId,
                    amount: Math.floor(refundAmount * 100)
                });

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
            refundAmount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error ending call' });
    }
});

router.post('/public/cancel/:callControlId', async (req, res) => {
    try {
        const { callControlId } = req.params;

        const call = await Call.findOne({ callControlId });
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }

        if (call.status === 'completed' || call.status === 'cancelled') {
            return res.status(400).json({ message: 'Call is already ended' });
        }

        // End the call in Telnyx
        await telnyxClient.calls.hangup(callControlId);

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
            refundAmount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling call' });
    }
});

router.get('/public/status/:callControlId', async (req, res) => {
    try {
        const { callControlId } = req.params;
        const { email } = req.query;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const call = await Call.findOne({ callControlId, userId: user._id });
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }

        res.json(call);
    } catch (error) {
        res.status(500).json({ message: 'Error getting call status' });
    }
});

export default router; 