import axios from "axios"
import { buildModel, type Parsed } from "./mesh"
import { fileName } from "./model"
import ParseWorker from "./parse.worker?worker"
import StepWorker from "./step.worker?worker"

type Reply = Parsed | { error: string }

const parseOffThread = (
  Parser: new () => Worker,
  buffer: ArrayBuffer,
  signal: AbortSignal,
) =>
  new Promise<Parsed>((resolve, reject) => {
    const worker = new Parser()

    const finish = () => {
      worker.terminate()
      signal.removeEventListener("abort", abort)
    }

    const abort = () => {
      finish()
      reject(signal.reason)
    }

    signal.addEventListener("abort", abort, { once: true })

    worker.addEventListener("message", (e: MessageEvent<Reply>) => {
      finish()

      if ("error" in e.data) {
        reject(new Error(e.data.error))
      } else {
        resolve(e.data)
      }
    })

    worker.addEventListener("error", e => {
      finish()
      reject(new Error(e.message || "Parser worker failed to start"))
    })

    worker.postMessage(buffer, [buffer])
  })

const loadMesh = async (
  Parser: new () => Worker,
  url: string,
  signal: AbortSignal,
  onProgress: (ratio: number | null) => void,
) => {
  const { data } = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    signal,
    onDownloadProgress: e => onProgress(e.progress ?? null),
  })

  onProgress(null)

  const bytes = data.byteLength
  const { parts, scan } = await parseOffThread(Parser, data, signal)

  return { model: buildModel(parts), scan, bytes }
}

const extensionOf = (url: string) =>
  fileName(url).toLowerCase().split(".").at(-1)

export const loadModel = (
  url: string,
  signal: AbortSignal,
  onProgress: (ratio: number | null) => void,
) => {
  switch (extensionOf(url)) {
    case "xml":
    case "mjb":
      return import("./mjcf").then(mjcf => mjcf.loadMjcf(url, signal))
    case "step":
    case "stp":
      return loadMesh(StepWorker, url, signal, onProgress)
    default:
      return loadMesh(ParseWorker, url, signal, onProgress)
  }
}

export const fetchText = async (url: string, signal: AbortSignal) => {
  const { data } = await axios.get<string>(url, {
    responseType: "text",
    signal,
  })

  return data
}
