import axios from "axios"
import { buildModel, type Parsed } from "./mesh"
import { fileName } from "./model"
import ParseWorker from "./parse.worker?worker"

type Reply = Parsed | { error: string }

const parseOffThread = (buffer: ArrayBuffer, signal: AbortSignal) =>
  new Promise<Parsed>((resolve, reject) => {
    const worker = new ParseWorker()

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

export const loadObj = async (
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
  const { parts, scan } = await parseOffThread(data, signal)

  return { model: buildModel(parts), scan, bytes }
}

const isMujoco = (url: string) => {
  const name = fileName(url).toLowerCase()

  return name.endsWith(".xml") || name.endsWith(".mjb")
}

export const loadModel = (
  url: string,
  signal: AbortSignal,
  onProgress: (ratio: number | null) => void,
) =>
  isMujoco(url)
    ? import("./mjcf").then(mjcf => mjcf.loadMjcf(url, signal))
    : loadObj(url, signal, onProgress)

export const fetchText = async (url: string, signal: AbortSignal) => {
  const { data } = await axios.get<string>(url, {
    responseType: "text",
    signal,
  })

  return data
}
