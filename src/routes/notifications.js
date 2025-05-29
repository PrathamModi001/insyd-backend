const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private (using query param for POC)
router.get('/', notificationController.getUserNotifications);

// @route   POST /api/notifications/:notificationId/read
// @desc    Mark notification as read
// @access  Private (using query param for POC)
router.post('/:notificationId/read', notificationController.markNotificationAsRead);

// @route   POST /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private (using query param for POC)
router.post('/read-all', notificationController.markAllNotificationsAsRead);

module.exports = router; 