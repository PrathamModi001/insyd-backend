const User = require('../models/User');
const { sendEvent } = require('../utils/aiven-kafka');

/**
 * @desc    Create a new user
 * @route   POST /api/users
 * @access  Public
 */
exports.createUser = async (req, res) => {
  try {
    const { username, email, displayName, profession, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with that email or username already exists' 
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      displayName,
      profession,
      bio
    });

    // For now, we don't emit user.create events to Kafka
    // as it's not needed for notifications

    res.status(201).json(user);
  } catch (error) {
    console.error(`Error creating user: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:userId
 * @access  Public
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-email'); // Don't expose email in public API

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(`Error getting user: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get all users with optional filtering
 * @route   GET /api/users
 * @access  Public
 */
exports.getUsers = async (req, res) => {
  try {
    const { search, profession, limit = 20, offset = 0 } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (profession) {
      query.profession = profession;
    }
    
    // Execute query with pagination
    const users = await User.find(query)
      .select('username displayName profession avatar')
      .limit(Number(limit))
      .skip(Number(offset))
      .sort({ createdAt: -1 });
      
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error(`Error getting users: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Follow a user
 * @route   POST /api/users/:userId/follow
 * @access  Private
 */
exports.followUser = async (req, res) => {
  try {
    // In a real app, we'd get the follower ID from authenticated user
    // For this POC, we'll use a query param
    const followerId = req.query.followerId;
    const targetId = req.params.userId;
    
    console.log(`Follow attempt: User ${followerId} trying to follow ${targetId}`);
    
    if (followerId === targetId) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    // Get both users
    const follower = await User.findById(followerId);
    const target = await User.findById(targetId);
    
    if (!follower || !target) {
      console.log('Follow failed: One or both users not found');
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if already following
    if (follower.following.includes(targetId)) {
      console.log(`Follow failed: ${followerId} already follows ${targetId}`);
      return res.status(400).json({ message: `User ${followerId} is already following user ${targetId}` });
    }
    
    // Update follower's following list
    follower.following.push(targetId);
    await follower.save();
    console.log(`Updated follower (${followerId}) following list: ${follower.following}`);
    
    // Update target's followers list
    target.followers.push(followerId);
    await target.save();
    console.log(`Updated target (${targetId}) followers list: ${target.followers}`);
    
    // Emit follow event to Kafka
    const event = {
      eventType: 'user.follow',
      actorId: followerId,
      targetId,
      targetType: 'User',
      payload: {
        actorUsername: follower.username,
        actorDisplayName: follower.displayName
      }
    };
    
    console.log('Sending follow event to Kafka:', JSON.stringify(event));
    await sendEvent('user-events', event);
    console.log('Follow event sent successfully');
    
    res.status(200).json({ 
      success: true, 
      message: 'Successfully followed user' 
    });
  } catch (error) {
    console.error(`Error following user: ${error.stack}`);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

/**
 * @desc    Unfollow a user
 * @route   POST /api/users/:userId/unfollow
 * @access  Private
 */
exports.unfollowUser = async (req, res) => {
  try {
    // In a real app, we'd get the unfollower ID from authenticated user
    const followerId = req.query.followerId;
    const targetId = req.params.userId;
    
    // Get both users
    const follower = await User.findById(followerId);
    const target = await User.findById(targetId);
    
    if (!follower || !target) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if not following
    if (!follower.following.includes(targetId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }
    
    // Update follower's following list
    follower.following = follower.following.filter(id => id.toString() !== targetId);
    await follower.save();
    
    // Update target's followers list
    target.followers = target.followers.filter(id => id.toString() !== followerId);
    await target.save();
    
    // Emit unfollow event to Kafka
    await sendEvent('user-events', {
      eventType: 'user.unfollow',
      actorId: followerId,
      targetId,
      targetType: 'User',
      payload: {}
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Successfully unfollowed user' 
    });
  } catch (error) {
    console.error(`Error unfollowing user: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update notification preferences
 * @route   PUT /api/users/notification-preferences
 * @access  Private
 */
exports.updateNotificationPreferences = async (req, res) => {
  try {
    // In a real app, we'd get the user ID from authenticated user
    const userId = req.query.userId;
    
    const { email, push, followActivity, contentActivity, digestFrequency } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update preferences
    if (email !== undefined) user.notificationPreferences.email = email;
    if (push !== undefined) user.notificationPreferences.push = push;
    if (followActivity !== undefined) user.notificationPreferences.followActivity = followActivity;
    if (contentActivity !== undefined) user.notificationPreferences.contentActivity = contentActivity;
    if (digestFrequency) user.notificationPreferences.digestFrequency = digestFrequency;
    
    await user.save();
    
    res.status(200).json({ 
      notificationPreferences: user.notificationPreferences 
    });
  } catch (error) {
    console.error(`Error updating notification preferences: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Login a user
 * @route   POST /api/users/login
 * @access  Public
 */
exports.loginUser = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ 
        message: 'User with that email does not exist' 
      });
    }

    // In a real app, we would validate password here
    // For this POC, we'll just return the user

    res.status(200).json(user);
  } catch (error) {
    console.error(`Error logging in: ${error.message}`);
    res.status(500).json({ message: 'Server error' });
  }
}; 