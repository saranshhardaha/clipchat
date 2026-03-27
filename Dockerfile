# Build stage — needs devDependencies (tsc, drizzle-kit, etc.)
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json ./packages/engine/
RUN npm install --workspace=packages/engine

COPY packages/engine/src ./packages/engine/src
COPY packages/engine/tsconfig.json ./packages/engine/

RUN npm run build -w packages/engine && \
    cp -r packages/engine/src/db/migrations packages/engine/dist/db/migrations

# Runner stage — production deps only
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json ./packages/engine/
RUN npm install --workspace=packages/engine --omit=dev

COPY --from=builder /app/packages/engine/dist ./packages/engine/dist

EXPOSE 3000
CMD ["node", "packages/engine/dist/index.js"]
