const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// @route   POST /api/users
// @desc    Create a new user
// @access  Public
router.post('/', userController.createUser);

// @route   POST /api/users/login
// @desc    Login a user
// @access  Public
router.post('/login', userController.loginUser);

// @route   GET /api/users/:userId
// @desc    Get user by ID
// @access  Public
router.get('/:userId', userController.getUserById);

// @route   GET /api/users
// @desc    Get all users with optional filtering
// @access  Public
router.get('/', userController.getUsers);

// @route   POST /api/users/:userId/follow
// @desc    Follow a user
// @access  Private (using query param for POC)
router.post('/:userId/follow', userController.followUser);

// @route   POST /api/users/:userId/unfollow
// @desc    Unfollow a user
// @access  Private (using query param for POC)
router.post('/:userId/unfollow', userController.unfollowUser);

// @route   PUT /api/users/notification-preferences
// @desc    Update notification preferences
// @access  Private (using query param for POC)
router.put('/notification-preferences', userController.updateNotificationPreferences);

module.exports = router; 