FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/web/package.json ./packages/web/
RUN npm install --workspace=packages/web --ignore-scripts

FROM deps AS builder
COPY packages/web ./packages/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w packages/web

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/public ./packages/web/public
EXPOSE 3001
ENV PORT=3001 HOSTNAME=0.0.0.0
CMD ["node", "packages/web/server.js"]
