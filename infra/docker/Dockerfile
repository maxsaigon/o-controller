FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./

# Copy package sources
COPY packages/shared/ packages/shared/
COPY packages/eiscp/ packages/eiscp/
COPY packages/service/ packages/service/

# Install dependencies
RUN npm install --ignore-scripts

# Build all packages in order
RUN npm run build -w @o-control/shared
RUN npm run build -w @o-control/eiscp
RUN npm run build -w @o-control/service

# ── Production stage ──
FROM node:20-alpine

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json* ./

# Copy built packages
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/eiscp/package.json packages/eiscp/package.json
COPY --from=builder /app/packages/eiscp/dist/ packages/eiscp/dist/
COPY --from=builder /app/packages/service/package.json packages/service/package.json
COPY --from=builder /app/packages/service/dist/ packages/service/dist/

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts

# Non-root user
RUN addgroup -g 1001 ocontrol && adduser -D -u 1001 -G ocontrol ocontrol
USER ocontrol

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8787/health || exit 1

CMD ["node", "packages/service/dist/index.js"]
