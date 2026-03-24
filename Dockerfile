FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY packages/engine/package.json ./packages/engine/
RUN npm install --workspace=packages/engine --production

COPY packages/engine/src ./packages/engine/src
COPY packages/engine/tsconfig.json ./packages/engine/

RUN npm run build -w packages/engine

EXPOSE 3000
CMD ["node", "packages/engine/dist/index.js"]
