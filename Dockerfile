# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build || (echo "Build failed!" && exit 1)
RUN ls -la dist/ || (echo "dist directory not found!" && exit 1)
RUN test -f dist/src/main.js || (echo "dist/src/main.js not found!" && exit 1)

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies (ignore scripts to avoid husky)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Verify the file exists
RUN test -f dist/src/main.js || (echo "ERROR: dist/src/main.js not found after copy!" && ls -la dist/ && exit 1)

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application
CMD ["node", "dist/src/main.js"]

