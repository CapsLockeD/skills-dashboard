# ── Skills Dashboard ──────────────────────────────────────────────────────────
# Multi-stage build for a lean production image.
# Requires git to be available at runtime for repo cloning and diffing.

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache git
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache git

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Copy default config and data (these are overridden by volume mounts)
COPY --from=builder /app/registry.config.json ./registry.config.json
COPY --from=builder /app/data ./data

# Persistent storage directories (should be mounted as Docker volumes)
RUN mkdir -p /app/repos /app/data && \
    chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

CMD ["npm", "start"]
