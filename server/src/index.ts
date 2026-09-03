import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createApp } from "./app.ts"
import { openDb } from "./db.ts"

const dbFile = process.env.NOTE_DB ?? "./data/note.db"
const tokenFile = join(dirname(dbFile), "token")

const loadToken = () => {
  if (process.env.NOTE_TOKEN) {
    return process.env.NOTE_TOKEN
  }

  if (existsSync(tokenFile)) {
    return readFileSync(tokenFile, "utf8").trim()
  }

  const token = randomBytes(24).toString("hex")

  mkdirSync(dirname(tokenFile), { recursive: true })
  writeFileSync(tokenFile, token, { mode: 0o600 })

  return token
}

const token = loadToken()
const webRoot = process.env.NOTE_WEB ?? "../build"
const web = existsSync(webRoot) ? webRoot : undefined
const server = Bun.serve({
  port: Number(process.env.PORT) || 47821,
  hostname: process.env.HOST ?? "0.0.0.0",
  fetch: createApp({ db: openDb(dbFile), token, webRoot: web }).fetch,
})

console.log(`note sync node listening on ${server.url}`)
console.log(`token: ${token}`)
console.log(web ? `serving web build from ${web}` : "no web build found")
