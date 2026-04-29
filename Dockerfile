# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ src/
COPY tsconfig.json ./
RUN npm run build

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NEXTCLOUD_URL=""
ENV NEXTCLOUD_USERNAME=""
ENV NEXTCLOUD_PASSWORD=""

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
