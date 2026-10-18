import { afterEach, describe, expect, test } from "bun:test"
import { discover, evaluate, validateSocket } from "../../scripts/cdp"
import {
  parseDebugArgs,
  runDebug,
  snapshotExpression,
} from "../../scripts/debug-lib"

type SocketData = { target: string }
const servers: ReturnType<typeof Bun.serve<SocketData>>[] = []
afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop(true)
  }
})

function mockCdp(port = 0) {
  const requests: {
    id: number
    method: string
    params: Record<string, unknown>
  }[] = []
  let closed = 0
  const server = Bun.serve<SocketData>({
    hostname: "127.0.0.1",
    port,
    fetch(request, server) {
      const path = new URL(request.url).pathname
      if (path === "/json/list") {
        return Response.json([
          {
            id: "main",
            type: "page",
            title: "Test Eris",
            url: "http://localhost:1430/settings",
            webSocketDebuggerUrl: `ws://127.0.0.1:${server.port}/devtools/page/main`,
          },
          {
            id: "unrelated",
            type: "page",
            title: "Other app",
            url: "https://example.com/",
            webSocketDebuggerUrl: `ws://127.0.0.1:${server.port}/devtools/page/unrelated`,
          },
        ])
      }
      if (path.startsWith("/devtools/page/")) {
        if (server.upgrade(request, { data: { target: path } })) {
          return
        }
      }
      return new Response("not found", { status: 404 })
    },
    websocket: {
      async message(socket, raw) {
        const request = JSON.parse(String(raw))
        requests.push(request)
        // Deliberately don't respond, exercising the real socket timeout path.
        if (request.params.expression === "hang") {
          return
        }
        if (request.params.expression === "protocol-error") {
          socket.send(
            JSON.stringify({
              id: request.id,
              error: { message: "Not supported" },
            }),
          )
          return
        }
        if (request.params.expression === "close") {
          socket.close()
          return
        }
        socket.send(
          JSON.stringify({ method: "Runtime.consoleAPICalled", params: {} }),
        )
        try {
          // Evaluate only test-provided expressions in this mock, never production input.
          const value = await Function(
            "window",
            `return (${request.params.expression})`,
          )({
            __TAURI_INTERNALS__: {
              invoke: async (command: string, args: unknown) => ({
                command,
                args,
              }),
            },
          })
          socket.send(
            JSON.stringify({
              id: request.id,
              result: { result: { type: typeof value, value } },
            }),
          )
        } catch (error) {
          socket.send(
            JSON.stringify({
              id: request.id,
              result: {
                exceptionDetails: {
                  text: "Uncaught",
                  exception:
                    typeof error === "string"
                      ? { type: "string", value: error }
                      : { description: String(error) },
                },
              },
            }),
          )
        }
      },
      close() {
        closed++
      },
    },
  })
  servers.push(server)
  return {
    endpoint: { port: server.port as number, origin: "http://localhost:1430" },
    address: `ws://127.0.0.1:${server.port}/devtools/page/main`,
    requests,
    closed: () => closed,
  }
}

describe("CDP debug client", () => {
  test("discovers only app pages and requires an explicit known target", async () => {
    const mock = mockCdp()
    const targets = await runDebug(
      parseDebugArgs(["desktop", "targets"]),
      mock.endpoint,
    )
    expect(targets).toEqual([
      {
        id: "main",
        type: "page",
        title: "Test Eris",
        url: "http://localhost:1430/settings",
      },
    ])
    await expect(
      runDebug(
        parseDebugArgs(["desktop", "eval", "unrelated", "1"]),
        mock.endpoint,
      ),
    ).rejects.toThrow("not a unique desktop page")
    expect(mock.requests).toHaveLength(0)
  })

  test("real WebSocket evaluates async expressions by value", async () => {
    const mock = mockCdp()
    const result = await runDebug(
      parseDebugArgs([
        "desktop",
        "eval",
        "main",
        "Promise.resolve({ answer: 42 })",
      ]),
      mock.endpoint,
    )
    expect(result).toEqual({ answer: 42 })
    expect(mock.requests).toEqual([
      {
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: "Promise.resolve({ answer: 42 })",
          awaitPromise: true,
          returnByValue: true,
        },
      },
    ])
    await Bun.sleep(10)
    expect(mock.closed()).toBe(1)
  })

  test("reports JavaScript exceptions and rejected promises", async () => {
    const mock = mockCdp()
    await expect(
      evaluate(
        mock.address,
        mock.endpoint.port,
        '(() => { throw new Error("boom"); })()',
      ),
    ).rejects.toThrow("JavaScript exception: Error: boom")
    await expect(
      evaluate(
        mock.address,
        mock.endpoint.port,
        'Promise.reject(new Error("async boom"))',
      ),
    ).rejects.toThrow("async boom")
    await expect(
      evaluate(
        mock.address,
        mock.endpoint.port,
        'Promise.reject("native failure")',
      ),
    ).rejects.toThrow("native failure")
  })

  test("invokes the internal Tauri API and awaits its result over CDP", async () => {
    const mock = mockCdp()
    expect(
      await runDebug(
        parseDebugArgs([
          "files",
          "invoke",
          "main",
          "test_command",
          '{"path":"test"}',
        ]),
        mock.endpoint,
      ),
    ).toEqual({ command: "test_command", args: { path: "test" } })
  })

  test("reports protocol errors and unexpected close", async () => {
    const mock = mockCdp()
    await expect(
      evaluate(mock.address, mock.endpoint.port, "protocol-error"),
    ).rejects.toThrow("CDP error: Not supported")
    await expect(
      evaluate(mock.address, mock.endpoint.port, "close"),
    ).rejects.toThrow("closed before a response")
  })

  test("timeout closes the socket", async () => {
    const mock = mockCdp()
    await expect(
      evaluate(mock.address, mock.endpoint.port, "hang", 30),
    ).rejects.toThrow("timed out")
    await Bun.sleep(10)
    expect(mock.closed()).toBe(1)
  })

  test("unrelated origin is not attachable", async () => {
    const mock = mockCdp()
    expect(
      await discover({ ...mock.endpoint, origin: "http://localhost:1440" }),
    ).toEqual([])
    await expect(
      runDebug(parseDebugArgs(["files", "targets"]), {
        ...mock.endpoint,
        origin: "http://localhost:1440",
      }),
    ).rejects.toThrow("refusing unrelated")
  })

  test("rejects non-loopback, mismatched ports, credentials, and non-page sockets", () => {
    for (const address of [
      "ws://example.com:9310/devtools/page/main",
      "ws://127.0.0.1:9311/devtools/page/main",
      "wss://127.0.0.1:9310/devtools/page/main",
      "ws://user@127.0.0.1:9310/devtools/page/main",
      "ws://127.0.0.1:9310/devtools/browser/main",
    ]) {
      expect(() => validateSocket(address, 9310)).toThrow("Refusing CDP")
    }
    expect(validateSocket("ws://localhost:9310/devtools/page/main", 9310)).toBe(
      "ws://127.0.0.1:9310/devtools/page/main",
    )
  })
})

describe("debug argument parsing", () => {
  test("invoke uses internal Tauri API and safely JSON-encodes arguments", () => {
    const request = parseDebugArgs([
      "files",
      "invoke",
      "main",
      'command"test',
      '{"path":"C:\\\\file"}',
    ])
    expect(request).toHaveProperty(
      "expression",
      'window.__TAURI_INTERNALS__.invoke("command\\"test", {"path":"C:\\\\file"})',
    )
    expect(
      parseDebugArgs(["terminal", "invoke", "main", "status"]),
    ).toHaveProperty(
      "expression",
      'window.__TAURI_INTERNALS__.invoke("status", {})',
    )
  })

  test("snapshot captures bounded visible text, URL, and title", () => {
    expect(parseDebugArgs(["desktop", "snapshot", "main"])).toHaveProperty(
      "expression",
      snapshotExpression,
    )
    const execute = Function(
      "document",
      "location",
      `return ${snapshotExpression}`,
    )
    expect(
      execute(
        { title: "Window", body: { innerText: "a".repeat(20_001) } },
        { href: "url" },
      ),
    ).toEqual({
      url: "url",
      title: "Window",
      text: "a".repeat(20_000),
      truncated: true,
    })
  })

  test("rejects missing target, invalid command, extras and malformed JSON", () => {
    for (const args of [
      [],
      ["other", "targets"],
      ["desktop", "eval"],
      ["desktop", "eval", "main"],
      ["desktop", "eval", "main", " "],
      ["desktop", "snapshot", "main", "extra"],
      ["desktop", "targets", "extra"],
      ["desktop", "unknown", "main"],
      ["files", "invoke", "main", "status", "{"],
      ["files", "invoke", "main", "status", "[]"],
      ["files", "invoke", "main", "status", "null"],
    ]) {
      expect(() => parseDebugArgs(args)).toThrow()
    }
  })

  test("CLI failures produce only diagnostics on stderr and a nonzero exit", async () => {
    const child = Bun.spawn(
      [process.execPath, "scripts/debug.ts", "files", "eval"],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [stdout, stderr, exit] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(stdout).toBe("")
    expect(stderr).toContain("explicit target-id")
    expect(exit).toBe(1)
  })

  test.skipIf(process.platform !== "win32")(
    "Windows CLI writes evaluation result as JSON stdout",
    async () => {
      const mock = mockCdp()
      const child = Bun.spawn(
        [
          process.execPath,
          "--eval",
          `import { debugMain } from "./scripts/debug.ts";
          process.exitCode = await debugMain(
            ["desktop", "eval", "main", "Promise.resolve({ answer: 42 })"],
            ${JSON.stringify(mock.endpoint)}
          );`,
        ],
        { stdout: "pipe", stderr: "pipe" },
      )
      const [stdout, stderr, exit] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(JSON.parse(stdout)).toEqual({ answer: 42 })
      expect(stderr).toBe("")
      expect(exit).toBe(0)
    },
  )
})
