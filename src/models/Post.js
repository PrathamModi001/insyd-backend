const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Method to add a like
PostSchema.methods.addLike = function(userId) {
  // Check if user already liked this post
  if (this.likes.includes(userId)) {
    return false;
  }
  
  // Add the like
  this.likes.push(userId);
  return true;
};

// Method to remove a like
PostSchema.methods.removeLike = function(userId) {
  // Check if user already liked this post
  if (!this.likes.includes(userId)) {
    return false;
  }
  
  // Remove the like
  this.likes = this.likes.filter(id => id.toString() !== userId.toString());
  return true;
};

// Update the updatedAt field on save
PostSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient querying
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });

module.exports = mongoose.model('Post', PostSchema); 