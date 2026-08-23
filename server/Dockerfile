# ---- HelloWorld Backend (Node/Express) ----
FROM node:18-alpine AS base

# Add a non-root user's home for temp file uploads (express-fileupload writes to /tmp)
WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# express-fileupload needs a writable temp dir
RUN mkdir -p /tmp && chown -R node:node /app /tmp

ENV NODE_ENV=production
EXPOSE 4000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||4000)+'/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
