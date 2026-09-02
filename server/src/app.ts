import { timingSafeEqual } from "node:crypto"
import { and, asc, eq, gt, inArray } from "drizzle-orm"
import type { MiddlewareHandler } from "hono"
import { Hono } from "hono"
import { validator } from "hono/validator"
import {
  type DeviceInfo,
  type HealthResponse,
  isSyncedCollection,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type RegisterRequest,
  type ResetResponse,
  type SyncRecord,
} from "../../src/lib/sync/protocol.ts"
import pkg from "../package.json" with { type: "json" }
import type { Db, Tx } from "./db.ts"
import { devices, meta, records } from "./schema.ts"

const auth =
  (token: string): MiddlewareHandler =>
  async (c, next) => {
    const header = c.req.header("authorization") ?? ""
    const given = Buffer.from(
      header.startsWith("Bearer ") ? header.slice(7) : "",
    )
    const expected = Buffer.from(token)
    const ok =
      given.length === expected.length && timingSafeEqual(given, expected)

    if (!ok) {
      return c.json({ error: "unauthorized" }, 401)
    }

    await next()
  }

const isText = (v: unknown): v is string => typeof v === "string" && v !== ""

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null

const isRecord = (v: unknown): v is SyncRecord =>
  isObject(v) &&
  isText(v.collection) &&
  isSyncedCollection(v.collection) &&
  isText(v.id) &&
  Number.isFinite(v.updatedAt) &&
  typeof v.deleted === "boolean" &&
  isText(v.deviceId)

const isRegister = (v: unknown): v is RegisterRequest =>
  isObject(v) && isText(v.deviceId) && typeof v.deviceName === "string"

const isPush = (v: unknown): v is PushRequest =>
  isRegister(v) && Array.isArray((v as Record<string, unknown>).records)

const body = <T>(guard: (v: unknown) => v is T) =>
  validator("json", (value, c) =>
    guard(value) ? value : c.json({ error: "invalid body" }, 400),
  )

const readSeq = (tx: Db | Tx) =>
  Number(tx.select().from(meta).where(eq(meta.key, "seq")).get()?.value ?? 0)

const writeSeq = (tx: Tx, seq: number) =>
  tx
    .insert(meta)
    .values({ key: "seq", value: String(seq) })
    .onConflictDoUpdate({ target: meta.key, set: { value: String(seq) } })
    .run()

const touchDevice = (
  tx: Db | Tx,
  id: string,
  name: string,
  now: number,
): DeviceInfo =>
  tx
    .insert(devices)
    .values({ id, name: name || id, createdAt: now, lastSeen: now })
    .onConflictDoUpdate({
      target: devices.id,
      set: name ? { name, lastSeen: now } : { lastSeen: now },
    })
    .returning()
    .get()

const wins = (
  incoming: SyncRecord,
  existing: { updatedAt: number; deviceId: string },
) =>
  incoming.updatedAt > existing.updatedAt ||
  (incoming.updatedAt === existing.updatedAt &&
    incoming.deviceId < existing.deviceId)

const clampLimit = (raw: string | undefined) =>
  Math.min(Math.max(Number(raw) || 200, 1), 500)

export const createApp = ({ db, token }: { db: Db; token: string }) => {
  const app = new Hono()

  app.get("/health", c => {
    const res: HealthResponse = {
      ok: true,
      version: pkg.version,
      seq: readSeq(db),
    }

    return c.json(res)
  })

  app.use("/sync/*", auth(token))
  app.use("/devices/*", auth(token))
  app.use("/collections/*", auth(token))

  app.post("/sync/register", body(isRegister), c => {
    const req = c.req.valid("json")

    return c.json(touchDevice(db, req.deviceId, req.deviceName, Date.now()))
  })

  app.post("/sync/push", body(isPush), c => {
    const req = c.req.valid("json")
    const now = Date.now()

    const res = db.transaction(tx => {
      touchDevice(tx, req.deviceId, req.deviceName, now)

      let seq = readSeq(tx)
      let applied = 0
      const stale: string[] = []

      for (const r of req.records as unknown[]) {
        if (!isRecord(r)) {
          if (isObject(r) && isText(r.id)) {
            stale.push(r.id)
          }

          continue
        }

        const existing = tx
          .select({ updatedAt: records.updatedAt, deviceId: records.deviceId })
          .from(records)
          .where(
            and(eq(records.collection, r.collection), eq(records.id, r.id)),
          )
          .get()

        if (existing && !wins(r, existing)) {
          stale.push(r.id)
          continue
        }

        seq += 1
        const row = {
          seq,
          updatedAt: r.updatedAt,
          deleted: r.deleted,
          deviceId: r.deviceId,
          data: r.data ?? null,
        }

        tx.insert(records)
          .values({ collection: r.collection, id: r.id, ...row })
          .onConflictDoUpdate({
            target: [records.collection, records.id],
            set: row,
          })
          .run()

        applied += 1
      }

      writeSeq(tx, seq)

      const out: PushResponse = { seq, applied, stale }

      return out
    })

    return c.json(res)
  })

  app.get("/sync/pull", c => {
    const since = Number(c.req.query("since") ?? 0)

    if (!Number.isFinite(since)) {
      return c.json({ error: "invalid since" }, 400)
    }

    const limit = clampLimit(c.req.query("limit"))
    const device = c.req.query("device")

    if (device) {
      db.update(devices)
        .set({ lastSeen: Date.now() })
        .where(eq(devices.id, device))
        .run()
    }

    const only = (c.req.query("collections") ?? "")
      .split(",")
      .filter(isSyncedCollection)

    const rows = db
      .select()
      .from(records)
      .where(
        only.length > 0
          ? and(gt(records.seq, since), inArray(records.collection, only))
          : gt(records.seq, since),
      )
      .orderBy(asc(records.seq))
      .limit(limit + 1)
      .all()

    const res: PullResponse = {
      seq: readSeq(db),
      records: rows.slice(0, limit),
      hasMore: rows.length > limit,
    }

    return c.json(res)
  })

  app.get("/devices", c => {
    const rows: DeviceInfo[] = db
      .select()
      .from(devices)
      .orderBy(asc(devices.createdAt))
      .all()

    return c.json(rows)
  })

  app.delete("/devices/:id", c => {
    db.delete(devices)
      .where(eq(devices.id, c.req.param("id")))
      .run()

    return c.body(null, 204)
  })

  app.delete("/collections/:name", c => {
    const name = c.req.param("name")

    if (!isSyncedCollection(name)) {
      return c.json({ error: "unknown collection" }, 400)
    }

    const purge = c.req.query("purge") === "1"
    const now = Date.now()

    const res = db.transaction(tx => {
      if (purge) {
        const removed = tx
          .delete(records)
          .where(eq(records.collection, name))
          .returning({ id: records.id })
          .all()

        const out: ResetResponse = {
          seq: readSeq(tx),
          tombstoned: removed.length,
        }

        return out
      }

      const live = tx
        .select({ id: records.id, updatedAt: records.updatedAt })
        .from(records)
        .where(and(eq(records.collection, name), eq(records.deleted, false)))
        .all()

      let seq = readSeq(tx)

      for (const row of live) {
        seq += 1
        tx.update(records)
          .set({
            deleted: true,
            updatedAt: Math.max(now, row.updatedAt + 1),
            seq,
          })
          .where(and(eq(records.collection, name), eq(records.id, row.id)))
          .run()
      }

      writeSeq(tx, seq)

      const out: ResetResponse = { seq, tombstoned: live.length }

      return out
    })

    return c.json(res)
  })

  return app
}

export type App = ReturnType<typeof createApp>
