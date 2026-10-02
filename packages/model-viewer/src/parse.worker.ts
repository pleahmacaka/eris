import { parseObj } from "./mesh"

addEventListener("message", (e: MessageEvent<ArrayBuffer>) => {
  try {
    const parsed = parseObj(new TextDecoder().decode(e.data))
    const buffers = parsed.parts.flatMap(part =>
      Object.values(part.attributes).map(a => a.array.buffer),
    )
    const transfer = [...new Set(buffers)].filter(b => b instanceof ArrayBuffer)

    postMessage(parsed, { transfer })
  } catch (error) {
    postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
