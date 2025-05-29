const Post = require('../models/Post');
const User = require('../models/User');
const { sendEvent } = require('../utils/aiven-kafka');

/**
 * @desc    Create a new post
 * @route   POST /api/posts
 * @access  Private
 */
exports.createPost = async (req, res) => {
  try {
    const { title, content, tags, user } = req.body;

    // Validate user
    const userObj = await User.findById(user);
    if (!userObj) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create post
    const post = await Post.create({
      title,
      content,
      tags,
      user
    });

    // Get populated post to return
    const populatedPost = await Post.findById(post._id).populate({
      path: 'user',
      select: 'username displayName profession',
      model: 'User'
    });

    // Format response
    const formattedPost = {
      ...populatedPost.toObject(),
      user: populatedPost.user,
      userId: populatedPost.user._id
    };

    // Emit post.create event to Kafka for notification processing
    await sendEvent('post-events', {
      eventType: 'post.create',
      actorId: user,
      targetId: post._id,
      targetType: 'Post',
      payload: {
        postTitle: title,
        postId: post._id,
        actorUsername: userObj.username,
        actorDisplayName: userObj.displayName
      }
    });

    res.status(201).json(formattedPost);
  } catch (error) {
    console.error(`Error creating post: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get all posts
 * @route   GET /api/posts
 * @access  Public
 */
exports.getPosts = async (req, res) => {
  try {
    const { userId, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    // Filter by user if provided
    if (userId) {
      query.user = userId;
    }
    
    // Get posts with pagination
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate({
        path: 'user',
        select: 'username displayName profession',
        model: 'User'
      });
    
    // Format posts for response, safely handling null userId
    const formattedPosts = posts.map(post => {
      const postObj = post.toObject();
      
      // Check if userId exists before accessing its properties
      if (!postObj.user) {
        return {
          ...postObj,
          user: null,
          userId: null // Set userId to null if it doesn't exist
        };
      }
      
      return {
        ...postObj,
        user: postObj.user,
        userId: postObj.user._id
      };
    });
    
    // Get total post count for pagination
    const total = await Post.countDocuments(query);
    
    res.json({
      posts: formattedPosts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(`Error getting posts: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get post by ID
 * @route   GET /api/posts/:postId
 * @access  Public
 */
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate({
        path: 'user',
        select: 'username displayName profession',
        model: 'User'
      });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Format post for response, safely handling null userId
    const postObj = post.toObject();
    let formattedPost;
    
    if (!postObj.user) {
      formattedPost = {
        ...postObj,
        user: null,
        userId: postObj.user // Keep original userId (which might be null)
      };
    } else {
      formattedPost = {
        ...postObj,
        user: postObj.user,
        userId: postObj.user._id
      };
    }

    res.json(formattedPost);
  } catch (error) {
    console.error(`Error getting post: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Like a post
 * @route   POST /api/posts/:postId/like
 * @access  Private
 */
exports.likePost = async (req, res) => {
  try {
    const { userId } = req.query;
    const { postId } = req.params;

    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if already liked
    if (post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post already liked' });
    }

    // Add like
    post.likes.push(userId);
    await post.save();

    // Emit post.like event to Kafka
    if (post.user.toString() !== userId) {
      await sendEvent('post-events', {
        eventType: 'post.like',
        actorId: userId,
        targetId: postId,
        targetType: 'Post',
        payload: {
          postTitle: post.title,
          postId: post._id,
          postAuthorId: post.user,
          actorUsername: user.username,
          actorDisplayName: user.displayName
        }
      });
    }

    res.json({ message: 'Post liked successfully', likeCount: post.likes.length });
  } catch (error) {
    console.error(`Error liking post: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
}; 