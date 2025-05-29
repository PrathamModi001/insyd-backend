const { Kafka } = require('kafkajs');
require('dotenv').config();

// Create Kafka client
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'insyd-api-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

// Create producer
const producer = kafka.producer();

// Initialize Kafka producer
const initKafka = async () => {
  try {
    await producer.connect();
    console.log('Kafka producer connected');
    return producer;
  } catch (error) {
    console.error(`Error connecting to Kafka: ${error.message}`);
    process.exit(1);
  }
};

// Send event to Kafka
const sendEvent = async (topic, event) => {
  try {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
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
    return false;
  }
};

module.exports = {
  kafka,
  producer,
  initKafka,
  sendEvent,
}; 