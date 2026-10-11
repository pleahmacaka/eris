import { type AppName, appName, apps, readAppConfig } from "./apps"
import { discover, type Endpoint, evaluate } from "./cdp"

export const debugHelp = `Usage:
  bun run debug <desktop|files|terminal> targets
  bun run debug <app> eval <target-id> <expression>
  bun run debug <app> invoke <target-id> <command> [JSON object args]
  bun run debug <app> snapshot <target-id>

Windows only. Start the app with bun run dev [app] [--headless] first.
Copy an explicit target id from targets; no window is selected automatically.
Successful results are JSON on stdout; errors go to stderr with exit code 1.
Evaluation awaits promises, returns values, and times out after 10 seconds.`

export type DebugRequest =
  | { app: AppName; action: "targets" }
  | {
      app: AppName
      action: "eval" | "invoke" | "snapshot"
      targetId: string
      expression: string
    }

export const snapshotExpression = `(() => {
  const text = document.body?.innerText ?? "";
  return {
    url: location.href,
    title: document.title,
    text: text.slice(0, 20000),
    truncated: text.length > 20000
  };
})()`

export function parseDebugArgs(args: string[]): DebugRequest {
  const [name, action, targetId, value, rawArgs] = args
  if (!name) {
    throw new Error(debugHelp)
  }
  const app = appName(name)
  if (action === "targets" && args.length === 2) {
    return { app, action }
  }
  if (!targetId) {
    throw new Error(`An explicit target-id is required.\n${debugHelp}`)
  }
  if (action === "snapshot" && args.length === 3) {
    return { app, action, targetId, expression: snapshotExpression }
  }
  if (action === "eval" && args.length === 4 && value?.trim()) {
    return { app, action, targetId, expression: value }
  }
  if (
    action === "invoke" &&
    (args.length === 4 || args.length === 5) &&
    value?.trim()
  ) {
    const params = rawArgs === undefined ? {} : JSON.parse(rawArgs)
    if (
      params === null ||
      typeof params !== "object" ||
      Array.isArray(params)
    ) {
      throw new Error("Invoke args must be a JSON object.")
    }
    return {
      app,
      action,
      targetId,
      expression: `window.__TAURI_INTERNALS__.invoke(${JSON.stringify(value)}, ${JSON.stringify(params)})`,
    }
  }
  throw new Error(`Invalid debug arguments.\n${debugHelp}`)
}

export async function runDebug(request: DebugRequest, endpoint?: Endpoint) {
  const connection = endpoint ?? {
    port: apps[request.app].port,
    origin: new URL((await readAppConfig(request.app)).build.devUrl).origin,
  }
  const targets = await discover(connection)
  if (request.action === "targets") {
    if (!targets.length) {
      throw new Error(
        `No ${request.app} page targets found. Start bun run dev ${request.app}; refusing unrelated CDP targets.`,
      )
    }
    return targets.map(({ id, type, title, url }) => ({ id, type, title, url }))
  }
  const matches = targets.filter(target => target.id === request.targetId)
  if (matches.length !== 1) {
    throw new Error(
      `Target "${request.targetId}" is not a unique ${request.app} page. Run targets again.`,
    )
  }
  return evaluate(
    matches[0].webSocketDebuggerUrl,
    connection.port,
    request.expression,
  )
}
