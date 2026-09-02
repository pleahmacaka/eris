import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { SyncedCollection } from "../../src/lib/sync/protocol.ts"

export const records = sqliteTable(
  "records",
  {
    collection: text().$type<SyncedCollection>().notNull(),
    id: text().notNull(),
    seq: integer().notNull().unique(),
    updatedAt: integer("updated_at").notNull(),
    deleted: integer({ mode: "boolean" }).notNull().default(false),
    deviceId: text("device_id").notNull(),
    data: text({ mode: "json" }).$type<unknown>(),
  },
  t => [primaryKey({ columns: [t.collection, t.id] })],
)

export const devices = sqliteTable("devices", {
  id: text().primaryKey(),
  name: text().notNull(),
  createdAt: integer("created_at").notNull(),
  lastSeen: integer("last_seen").notNull(),
})

export const meta = sqliteTable("meta", {
  key: text().primaryKey(),
  value: text().notNull(),
})
