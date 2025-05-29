const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private (using query param for POC)
router.post('/', postController.createPost);

// @route   GET /api/posts
// @desc    Get all posts with optional filtering
// @access  Public
router.get('/', postController.getPosts);

// @route   GET /api/posts/:postId
// @desc    Get post by ID
// @access  Public
router.get('/:postId', postController.getPostById);

// @route   POST /api/posts/:postId/like
// @desc    Like a post
// @access  Private (using query param for POC)
router.post('/:postId/like', postController.likePost);

module.exports = router; 