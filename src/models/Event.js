const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'user.follow', 
      'user.unfollow', 
      'user.profile.update',
      'post.create', 
      'post.like', 
      'post.unlike',
      'post.comment', 
      'post.mention',
      'notification.created',
      'notification.read',
      'notification.read_all'
    ]
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetId: {
    // ID of the target object (user, post, etc.)
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  targetType: {
    // Type of the target object
    type: String,
    enum: ['User', 'Post', 'Comment', 'Notification'],
    required: true
  },
  payload: {
    // Additional data related to the event
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient querying by actor and timestamp
EventSchema.index({ actorId: 1, timestamp: -1 });
// Index for efficient querying by target and timestamp
EventSchema.index({ targetId: 1, timestamp: -1 });
// Index for efficient querying by event type
EventSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model('Event', EventSchema); 