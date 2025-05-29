const { Kafka } = require('kafkajs');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { createServer } = require('http');
const { TOPICS, EVENT_TYPES } = require('../config/kafka');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Post = require('../models/Post');
const { AI } = require('../services/ai-service');

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/insyd')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Kafka configuration
const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:29092']
});

// Socket.io setup
const app = require('express')();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('authenticate', (userId) => {
    console.log(`User ${userId} authenticated`);
    socket.join(userId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start HTTP server for WebSockets
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Initialize Kafka consumer
const consumer = kafka.consumer({ groupId: 'notification-group' });

// Function to process user followed events
async function processUserFollowedEvent(data) {
  try {
    const { followerId, followedId, followerName } = data;
    
    // Create notification for the followed user
    const notification = new Notification({
      user: followedId,
      sender: followerId,
      type: 'follow',
      message: `${followerName} started following you`,
      refModel: 'User',
      refId: followerId
    });
    
    await notification.save();
    console.log(`Created follow notification: ${followerName} -> User ${followedId}`);
    
    // Send real-time notification via Socket.io
    io.to(followedId).emit('notification', notification);
  } catch (error) {
    console.error('Error processing user followed event:', error);
  }
}

// Function to process post created events
async function processPostCreatedEvent(data) {
  try {
    const { postId, userId, title, followers } = data;
    
    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return console.error(`User ${userId} not found for post creation event`);
    }
    
    // For each follower, create a notification
    for (const followerId of followers) {
      // Use AI to score the notification relevance (simplified for now)
      const relevanceScore = await AI.scoreNotificationRelevance({
        notificationType: 'new_post',
        userId: followerId,
        contentCreatorId: userId
      });
      
      console.log(`AI relevance score for notification to ${followerId}: ${relevanceScore}`);
      
      // Only send notification if relevance score is above threshold
      if (relevanceScore >= 0.5) {
        const notification = new Notification({
          user: followerId,
          sender: userId,
          type: 'new_post',
          message: `${user.displayName} published a new post: "${title}"`,
          refModel: 'Post',
          refId: postId
        });
        
        await notification.save();
        console.log(`Created post notification for user ${followerId}`);
        
        // Send real-time notification via Socket.io
        io.to(followerId).emit('notification', notification);
      } else {
        console.log(`Skipped notification to ${followerId} due to low relevance score`);
      }
    }
  } catch (error) {
    console.error('Error processing post created event:', error);
  }
}

// Function to process post liked events
async function processPostLikedEvent(data) {
  try {
    const { postId, postOwnerId, userId, userDisplayName, postTitle } = data;
    
    // Create notification for the post owner
    const notification = new Notification({
      user: postOwnerId,
      sender: userId,
      type: 'post_like',
      message: `${userDisplayName} liked your post: "${postTitle}"`,
      refModel: 'Post',
      refId: postId
    });
    
    await notification.save();
    console.log(`Created post like notification: ${userDisplayName} liked post by ${postOwnerId}`);
    
    // Send real-time notification via Socket.io
    io.to(postOwnerId).emit('notification', notification);
  } catch (error) {
    console.error('Error processing post liked event:', error);
  }
}

// Main function to start consuming Kafka events
async function start() {
  await consumer.connect();
  
  // Subscribe to topics
  await consumer.subscribe({ topics: [TOPICS.USER_EVENTS, TOPICS.POST_EVENTS] });
  
  // Start consuming events
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        console.log(`Received event: ${payload.type}`);
        
        switch (payload.type) {
          case EVENT_TYPES.USER_FOLLOWED:
            await processUserFollowedEvent(payload.data);
            break;
          case EVENT_TYPES.POST_CREATED:
            await processPostCreatedEvent(payload.data);
            break;
          case EVENT_TYPES.POST_LIKED:
            await processPostLikedEvent(payload.data);
            break;
          default:
            console.log(`Unhandled event type: ${payload.type}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  try {
    await consumer.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the service
start().catch(error => {
  console.error('Failed to start notification service:', error);
  process.exit(1);
}); 