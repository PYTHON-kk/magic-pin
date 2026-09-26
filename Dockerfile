FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests and install production dependencies
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server application source code and public assets
COPY server/src/ ./src/
COPY server/public/ ./public/

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/v1/healthz || exit 1

CMD ["node", "src/server.js"]
