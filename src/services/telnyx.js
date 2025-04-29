import dotenv from 'dotenv';
import telnyx from 'telnyx';

// Load environment variables
dotenv.config();

// Get Telnyx credentials
const apiKey = process.env.TELNYX_API_KEY;

// Log credentials status (for debugging)
console.log('Telnyx API Key:', apiKey ? 'Present' : 'Missing');

// Initialize Telnyx client only if credentials are present
let client;
if (apiKey) {
  client = telnyx(apiKey);
} else {
  console.error('Telnyx credentials are missing. Please check your .env file.');
  // Create a mock client for development
  client = {
    calls: {
      create: async () => {
        throw new Error('Telnyx credentials are missing');
      }
    }
  };
}

export default client; 