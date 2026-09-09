import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createApp } from "./app.ts"
import { openDb } from "./db.ts"

const dbFile = process.env.ERIS_DB ?? "./data/eris.db"
const tokenFile = join(dirname(dbFile), "token")

const loadToken = () => {
  if (process.env.ERIS_TOKEN) {
    return process.env.ERIS_TOKEN
  }

  if (existsSync(tokenFile)) {
    return readFileSync(tokenFile, "utf8").trim()
  }

  const token = randomBytes(24).toString("hex")
  mkdirSync(dirname(tokenFile), { recursive: true })
  writeFileSync(tokenFile, token, { mode: 0o600 })

  return token
}

const fromEnv = Boolean(process.env.ERIS_TOKEN)
const token = loadToken()
const app = createApp({ db: openDb(dbFile), token })

const server = Bun.serve({
  port: Number(process.env.PORT) || 8787,
  fetch: app.fetch,
})

console.log(`eris sync server listening on ${server.url}`)
console.log(
  fromEnv
    ? `token: ${token.slice(0, 4)}...`
    : `ERIS_TOKEN not set, using ${tokenFile}: ${token}`,
)
