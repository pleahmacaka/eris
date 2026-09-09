import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "./schema.ts"

export const openDb = (file = process.env.ERIS_DB ?? "./data/eris.db") => {
  if (file !== ":memory:") {
    mkdirSync(dirname(file), { recursive: true })
  }

  const sqlite = new Database(file, { create: true })
  sqlite.exec("PRAGMA journal_mode = WAL")

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: join(import.meta.dir, "..", "drizzle") })

  return db
}

export type Db = ReturnType<typeof openDb>

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
