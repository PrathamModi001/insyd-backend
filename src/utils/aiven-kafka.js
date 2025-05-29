const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Connection status tracking
let isConnected = false;
let connectionPromise = null;

// Get CA certificate from environment variable or file
let caCert;
try {
  if (process.env.CA_CERT) {
    // Use certificate directly from environment variable
    console.log('Using CA certificate from environment variable');
    caCert = Buffer.from(process.env.CA_CERT);
    console.log('✅ CA certificate loaded successfully from environment');
  } else {
    // Fall back to file if environment variable not set
    const caCertPath = process.env.CA_CERT_PATH || './ca.pem';
    const absoluteCertPath = path.resolve(process.cwd(), caCertPath);
    console.log(`Loading CA certificate from file: ${absoluteCertPath}`);
    caCert = fs.readFileSync(absoluteCertPath);
    console.log('✅ CA certificate loaded successfully from file');
  }
} catch (error) {
  console.error(`❌ Error loading CA certificate: ${error.message}`);
  // Don't exit the process here, we'll check before sending events
  console.log('Will attempt to connect without certificate');
}

// Create Kafka client
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'insyd-api-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  // Use SSL configuration with CA certificate if available
  ...(caCert ? {
    ssl: {
      ca: [caCert],
      rejectUnauthorized: false // Allow self-signed certificates
    }
  } : {}),
  // Use SASL if credentials are provided
  ...(process.env.KAFKA_USERNAME ? {
    sasl: {
      mechanism: process.env.KAFKA_MECHANISM || 'PLAIN',
      username: process.env.KAFKA_USERNAME || 'avnadmin',
      password: process.env.KAFKA_PASSWORD || '',
    }
  } : {}),
  // Increase connection timeout for better reliability
  connectionTimeout: 15000,
  // Add retry configuration
  retry: {
    initialRetryTime: 100,
    retries: 10
  }
});

// Create producer
const producer = kafka.producer();

// Initialize Kafka producer
const initKafka = async () => {
  // If we're already connecting, return the existing promise
  if (connectionPromise) {
    return connectionPromise;
  }
  
  // Create a new connection promise
  connectionPromise = (async () => {
    try {
      console.log('Connecting to Aiven Kafka...');
      console.log(`Broker: ${process.env.KAFKA_BROKERS}`);
      console.log(`Username: ${process.env.KAFKA_USERNAME || 'Not set'}`);
      console.log(`SSL Enabled: ${process.env.KAFKA_SSL || 'Not set'}`);
      
      await producer.connect();
      console.log('✅ Kafka producer connected to Aiven');
      isConnected = true;
      
      // Set up disconnect handler to reconnect automatically
      producer.on('producer.disconnect', async () => {
        console.log('Kafka producer disconnected, reconnecting...');
        isConnected = false;
        connectionPromise = null;
        await initKafka();
      });
      
      return producer;
    } catch (error) {
      console.error(`❌ Error connecting to Aiven Kafka: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
      // Reset connection state
      isConnected = false;
      connectionPromise = null;
      console.error('API service will continue without Kafka connectivity');
      return null;
    }
  })();
  
  return connectionPromise;
};

// Ensure connection before sending events
const ensureConnection = async () => {
  if (!isConnected) {
    console.log('Producer not connected, establishing connection...');
    await initKafka();
  }
  return isConnected;
};

// Send event to Kafka
const sendEvent = async (topic, event) => {
  try {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Ensure producer is connected
    await ensureConnection();
    
    // Check if still not connected after connection attempt
    if (!isConnected) {
      console.error('Failed to connect to Kafka, cannot send event');
      return false;
    }

    await producer.send({
      topic,
      messages: [
        { 
          key: event.targetId.toString(),
          value: JSON.stringify(event)
        },
      ],
    });

    console.log(`Event sent to ${topic}: ${event.eventType}`);
    return true;
  } catch (error) {
    console.error(`Error sending event to Kafka: ${error.message}`);
    // If connection error, reset connection state
    if (error.message.includes('not connected')) {
      isConnected = false;
      connectionPromise = null;
    }
    // Return false but don't throw, so the API can continue working
    return false;
  }
};

// Connect immediately on module load
initKafka().catch(console.error);

module.exports = {
  kafka,
  producer,
  initKafka,
  sendEvent,
}; 