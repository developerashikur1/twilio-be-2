import dotenv from 'dotenv';
import twilio from 'twilio';

// Load environment variables
dotenv.config();

// Get Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Log credentials status (for debugging)
console.log('Twilio Account SID:', accountSid ? 'Present' : 'Missing');
console.log('Twilio Auth Token:', authToken ? 'Present' : 'Missing');

// Initialize Twilio client only if credentials are present
let client;
if (accountSid && authToken) {
  client = new twilio.Twilio(accountSid, authToken);
} else {
  console.error('Twilio credentials are missing. Please check your .env file.');
  // Instead of throwing an error, we'll create a mock client for development
  client = {
    calls: {
      create: async () => {
        throw new Error('Twilio credentials are missing');
      }
    }
  };
}

export default client; 