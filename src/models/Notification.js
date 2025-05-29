const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['follow', 'like', 'comment', 'mention', 'post', 'system', 'new_post', 'post_like'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  refId: {
    // Reference to the object that triggered the notification (post, comment, etc.)
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  refModel: {
    // The model name for the refId
    type: String,
    enum: ['Post', 'User', 'Comment'],
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relevanceScore: {
    // AI-generated score for notification importance (0-100)
    type: Number,
    default: 50
  },
  __v: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying of user notifications
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema); 