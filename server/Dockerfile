FROM oven/bun:1 AS web
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app/server
COPY server/package.json server/bun.lock ./
RUN bun install --production --frozen-lockfile
COPY server/ ./
COPY src/lib/sync/protocol.ts /app/src/lib/sync/protocol.ts
COPY --from=web /app/build /app/build
ENV PORT=47821
ENV NOTE_WEB=/app/build
EXPOSE 47821
CMD ["bun", "run", "start"]
