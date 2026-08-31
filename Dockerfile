# ── Stage 1: Build frontend ──
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production server ──
FROM node:20-alpine AS production
WORKDIR /app

# Install backend dependencies (with prisma schema for postinstall generator)
COPY backend/package*.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Generate Prisma client (guaranteed)
RUN npx prisma generate

# Copy built frontend into backend static serving
COPY --from=frontend-build /app/frontend/dist ./public

# Create required directories
RUN mkdir -p uploads agent-output data

# Non-root user for security
RUN addgroup -g 1001 -S nova && \
    adduser -S nova -u 1001 -G nova && \
    chown -R nova:nova /app
USER nova

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
