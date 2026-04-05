# Phase 4.x Runtime - Production Image
FROM node:24-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts
COPY dist/ ./dist/
COPY src/server.ts ./src/server.ts

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
