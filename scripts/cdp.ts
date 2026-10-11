export type Target = {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl: string
}

export type Endpoint = { port: number; origin: string }
const timeoutMs = 10_000

export function validateSocket(address: string, port: number) {
  const url = new URL(address)
  if (
    url.protocol !== "ws:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    Number(url.port) !== port ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/devtools/page/")
  ) {
    throw new Error("Refusing CDP WebSocket outside the app's loopback port.")
  }
  // Use a literal IP rather than resolving localhost.
  url.hostname = "127.0.0.1"
  return url.href
}

export async function discover(endpoint: Endpoint): Promise<Target[]> {
  let response: Response
  try {
    response = await fetch(`http://127.0.0.1:${endpoint.port}/json/list`, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    })
  } catch (error) {
    throw new Error(
      `Cannot reach CDP at 127.0.0.1:${endpoint.port}. Start the app with bun run dev first. ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (!response.ok) {
    throw new Error(`CDP discovery failed: HTTP ${response.status}`)
  }
  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    throw new Error("Invalid CDP target list.")
  }
  const targets: Target[] = []
  for (const item of data) {
    if (
      typeof item?.id !== "string" ||
      item.type !== "page" ||
      typeof item.url !== "string"
    ) {
      continue
    }
    let origin: string
    try {
      origin = new URL(item.url).origin
    } catch {
      continue
    }
    if (origin !== endpoint.origin) {
      continue
    }
    if (typeof item.webSocketDebuggerUrl !== "string") {
      continue
    }
    validateSocket(item.webSocketDebuggerUrl, endpoint.port)
    targets.push({
      id: item.id,
      type: item.type,
      title: typeof item.title === "string" ? item.title : "",
      url: item.url,
      webSocketDebuggerUrl: item.webSocketDebuggerUrl,
    })
  }
  return targets
}

export function evaluate(
  address: string,
  port: number,
  expression: string,
  timeout = timeoutMs,
): Promise<unknown> {
  const socketUrl = validateSocket(address, port)
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl)
    let settled = false
    const finish = (error?: Error, value?: unknown) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      socket.removeEventListener("open", open)
      socket.removeEventListener("message", message)
      socket.removeEventListener("error", failed)
      socket.removeEventListener("close", closed)
      socket.close()
      if (error) {
        reject(error)
      } else {
        resolve(value)
      }
    }
    const timer = setTimeout(
      () => finish(new Error(`CDP evaluation timed out after ${timeout}ms.`)),
      timeout,
    )
    const open = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      )
    const failed = () => finish(new Error("CDP WebSocket connection failed."))
    const closed = () =>
      finish(new Error("CDP WebSocket closed before a response."))
    const message = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data))
        if (data.id !== 1) {
          return
        }
        if (data.error) {
          finish(
            new Error(
              `CDP error: ${data.error.message ?? JSON.stringify(data.error)}`,
            ),
          )
          return
        }
        const result = data.result
        if (result?.exceptionDetails) {
          const exception = result.exceptionDetails
          const detail =
            exception.exception?.description ??
            exception.exception?.value ??
            exception.text
          finish(
            new Error(
              `JavaScript exception: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
            ),
          )
          return
        }
        if (!result?.result) {
          throw new Error("Invalid CDP evaluation response.")
        }
        const remote = result.result
        // Undefined cannot be encoded in JSON; use null consistently.
        finish(undefined, remote.value ?? remote.unserializableValue ?? null)
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)))
      }
    }
    socket.addEventListener("open", open)
    socket.addEventListener("message", message)
    socket.addEventListener("error", failed)
    socket.addEventListener("close", closed)
  })
}
