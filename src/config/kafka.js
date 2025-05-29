// Kafka topics
const TOPICS = {
  NOTIFICATIONS: 'notifications',
  USER_EVENTS: 'user-events',
  POST_EVENTS: 'post-events'
};

// Kafka event types
const EVENT_TYPES = {
  USER_REGISTERED: 'user-registered',
  USER_FOLLOWED: 'user-followed',
  POST_CREATED: 'post-created',
  POST_LIKED: 'post-liked',
  COMMENT_ADDED: 'comment-added'
};

module.exports = {
  TOPICS,
  EVENT_TYPES
}; 