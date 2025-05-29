const Notification = require('../models/Notification');
const { sendEvent } = require('../utils/aiven-kafka');
const mongoose = require('mongoose');

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getUserNotifications = async (req, res) => {
  try {
    // In a real app, we'd get the user ID from authenticated user
    // For this POC, we'll use a query param
    const userId = req.query.userId;
    const { limit = 20, offset = 0, read, type, since } = req.query;
    
    // Build query
    const query = { recipient: userId };
    
    if (read === 'true') {
      query.isRead = true;
    } else if (read === 'false') {
      query.isRead = false;
    }
    
    if (type) {
      query.type = type;
    }
    
    // If 'since' parameter is provided, only get notifications newer than the specified ID
    if (since && mongoose.Types.ObjectId.isValid(since)) {
      try {
        // Get the 'since' notification to check its timestamp
        const sinceNotification = await Notification.findById(since);
        
        if (sinceNotification) {
          // Only get notifications created after the 'since' notification
          query.createdAt = { $gt: sinceNotification.createdAt };
          
          console.log(`Fetching notifications newer than ID ${since} (${sinceNotification.createdAt})`);
        } else {
          console.log(`'since' notification ID ${since} not found, ignoring parameter`);
        }
      } catch (error) {
        console.error(`Error processing 'since' parameter: ${error.message}`);
        // Continue without the since filter if there's an error
      }
    }
    
    // Execute query with pagination
    const notifications = await Notification.find(query)
      .populate('sender', 'username displayName avatar')
      .limit(Number(limit))
      .skip(Number(offset))
      .sort({ createdAt: -1 });
      
    // Get unread count
    const unreadCount = await Notification.countDocuments({ 
      recipient: userId, 
      isRead: false 
    });
    
    // Get total count for pagination
    const total = await Notification.countDocuments(query);
    
    res.json({
      notifications,
      unreadCount,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error(`Error getting notifications: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Mark notification as read
 * @route   POST /api/notifications/:notificationId/read
 * @access  Private
 */
exports.markNotificationAsRead = async (req, res) => {
  try {
    // In a real app, we'd get the user ID from authenticated user
    // For this POC, we'll use a query param
    const userId = req.query.userId;
    const notificationId = req.params.notificationId;
    
    // Find notification
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if notification belongs to user
    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Mark as read if not already
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
      
      // Emit event to Kafka
      await sendEvent('notification-events', {
        eventType: 'notification.read',
        actorId: userId,
        targetId: notificationId,
        targetType: 'Notification',
        payload: {
          notificationType: notification.type
        }
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Notification marked as read' 
    });
  } catch (error) {
    console.error(`Error marking notification as read: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   POST /api/notifications/read-all
 * @access  Private
 */
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    // In a real app, we'd get the user ID from authenticated user
    // For this POC, we'll use a query param
    const userId = req.query.userId;
    
    // Find all unread notifications for user
    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );
    
    // Emit event to Kafka
    await sendEvent('notification-events', {
      eventType: 'notification.read_all',
      actorId: userId,
      targetId: userId,
      targetType: 'User',
      payload: {
        count: result.modifiedCount
      }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'All notifications marked as read',
      count: result.modifiedCount
    });
  } catch (error) {
    console.error(`Error marking all notifications as read: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
}; 