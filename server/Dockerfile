FROM oven/bun:1
WORKDIR /app/server
COPY server/package.json server/bun.lock ./
RUN bun install --production --frozen-lockfile
COPY server/ ./
COPY src/lib/sync/protocol.ts /app/src/lib/sync/protocol.ts
ENV PORT=8787
EXPOSE 8787
CMD ["bun", "run", "start"]
