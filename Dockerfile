# Use Node.js LTS as base image
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies with more verbose output and fallback to regular install
RUN npm install --verbose

# Copy app source code
COPY . .

# Expose ports for API server and Socket.IO
EXPOSE 3001
EXPOSE 3002

# Set environment variables (these can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3001
ENV NOTIFICATION_PORT=3002
ENV NOTIFICATION_HOST=0.0.0.0

# Start the application
CMD ["node", "src/index.js"] 