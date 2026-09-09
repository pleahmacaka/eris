FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY packages/sync/package.json packages/sync/
RUN bun install --production --frozen-lockfile --filter eris-server
COPY packages/sync packages/sync
COPY apps/server apps/server
WORKDIR /app/apps/server
ENV PORT=8787
EXPOSE 8787
CMD ["bun", "run", "start"]
