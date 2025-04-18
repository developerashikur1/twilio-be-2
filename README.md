# Twilio Call Application with Stripe Integration

A modern web application that allows users to make calls using Twilio and manage their talk time balance through Stripe payments.

## Features

- User authentication
- Twilio call integration
- Stripe payment processing
- Real-time call status tracking
- Automatic balance management
- Refund system for cancelled calls

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Twilio account
- Stripe account

## Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/twilio-call-app
   JWT_SECRET=your_jwt_secret_key
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   BASE_URL=https://eb81-103-159-115-12.ngrok-free.app
   ```

4. Start MongoDB
5. Run the application:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login user

### Calls

- POST `/api/calls/initiate` - Initiate a new call
- POST `/api/calls/end/:callSid` - End a call
- GET `/api/calls/status/:callSid` - Get call status

### Payments

- POST `/api/payments/create-payment-intent` - Create payment intent
- POST `/api/payments/success` - Handle successful payment
- POST `/api/payments/refund/:callSid` - Process refund for cancelled call

## Security Features

- JWT-based authentication
- Password hashing
- Secure payment processing
- Input validation
- Error handling

## Frontend Integration

The frontend should be built using React and should include:

- User authentication forms
- Call interface
- Payment processing
- Balance display
- Call status monitoring

## Notes

- The application uses a rate of $0.01 per second for calls
- Refunds are processed automatically for cancelled calls
- All sensitive data is stored securely
- The application follows ES6+ standards

# twilio-be-2
