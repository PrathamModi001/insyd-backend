const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import utilities
const connectDB = require('./utils/database');
const { initKafka } = require('./utils/aiven-kafka');

// Import routes
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const postRoutes = require('./routes/posts');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.IO for client connections
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow connections from any origin
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set up a separate Socket.IO server to receive notifications from notification service
const notificationServer = http.createServer();
const notificationIo = socketIo(notificationServer, {
  cors: {
    origin: '*', // Allow connections from the notification service
    methods: ['GET', 'POST'],
    credentials: false
  },
  transports: ['polling', 'websocket'], // Support both polling and websocket
  allowEIO3: true,
  pingTimeout: 60000, // Increased timeouts to avoid disconnections
  pingInterval: 25000,
  connectTimeout: 30000,
  maxHttpBufferSize: 1e8 // 100MB buffer size for larger payloads
});

// Middleware
app.use(cors({
  origin: '*', // Allow requests from any origin
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// API Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Insyd API' });
});

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/posts', postRoutes);

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Associate user ID with socket for notifications
  socket.on('authenticate', (userId) => {
    console.log(`User ${userId} authenticated on socket ${socket.id}`);
    socket.join(`user:${userId}`);
    // Confirm to the client that they've joined the room
    socket.emit('joined', { room: `user:${userId}` });
  });
  
  // Alternative explicit room joining
  socket.on('join', (room) => {
    console.log(`Socket ${socket.id} joining room: ${room}`);
    socket.join(room);
    // Confirm to the client that they've joined the room
    socket.emit('joined', { room });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Listen for connections from the notification service
notificationIo.on('connection', (socket) => {
  console.log('Notification service connected:', socket.id);
  
  // Listen for notification events from the notification service
  socket.on('notification', (data) => {
    console.log('Received notification from notification service:', data);
    try {
      const { room, data: notification } = data;
      
      console.log(`Attempting to forward notification to room: ${room}`);
      console.log(`Notification data:`, JSON.stringify(notification));
      
      // Check if the room exists and has sockets
      const roomSockets = io.sockets.adapter.rooms.get(room);
      const roomExists = !!roomSockets;
      const socketCount = roomExists ? roomSockets.size : 0;
      console.log(`Room ${room} exists: ${roomExists}, connected sockets: ${socketCount}`);
      
      // Forward to the client via the main Socket.io server
      io.to(room).emit('notification', notification);
      console.log(`Notification forwarded to ${room}`);
      
      // Acknowledge receipt
      socket.emit('notificationReceived', { success: true, roomDelivered: room });
    } catch (error) {
      console.error('Error processing notification:', error);
      socket.emit('notificationError', { error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Notification service disconnected');
  });
  
  // Send a welcome message
  socket.emit('welcome', { message: 'Connected to API notification server' });
});

// Start notification server
const NOTIFICATION_PORT = process.env.NOTIFICATION_PORT || 3002;
const NOTIFICATION_HOST = process.env.NOTIFICATION_HOST || '0.0.0.0'; // Listen on all interfaces by default
notificationServer.listen(NOTIFICATION_PORT, NOTIFICATION_HOST, () => {
  console.log(`Notification server listening on ${NOTIFICATION_HOST}:${NOTIFICATION_PORT}`);
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3001;
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 3002;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize Kafka
    await initKafka();
    
    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`API Server running on port ${PORT}`);
    });
    
    // Export io instance for use in other modules
    module.exports = { io };
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer(); 