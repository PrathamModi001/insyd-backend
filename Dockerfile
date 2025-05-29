# Use Node.js LTS as base image
FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install build dependencies for native modules (especially for node-rdkafka)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    librdkafka-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install

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