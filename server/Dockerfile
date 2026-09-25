FROM node:20-alpine

WORKDIR /app

# Copy package manifests from server/ and install dependencies
COPY server/package*.json ./
RUN npm ci --only=production

# Copy source code from server/src/
COPY server/src/ ./src/

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/v1/healthz || exit 1

CMD ["node", "src/server.js"]
