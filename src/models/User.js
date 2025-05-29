const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: '/default-avatar.png'
  },
  bio: {
    type: String,
    default: '',
    maxlength: 250
  },
  profession: {
    type: String,
    enum: ['Architect', 'Interior Designer', 'Landscape Architect', 'Urban Planner', 'Other'],
    default: 'Other'
  },
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    followActivity: {
      type: Boolean,
      default: true
    },
    contentActivity: {
      type: Boolean,
      default: true
    },
    digestFrequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly', 'never'],
      default: 'immediate'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', UserSchema); 