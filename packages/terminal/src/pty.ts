import { Channel, invoke } from "@tauri-apps/api/core"

export type Shell = { id: string; name: string }

export type SpawnOptions = {
  shell: string
  cwd: string | null
  cols: number
  rows: number
}

export type AttachOptions = {
  onData: (data: Uint8Array) => void
  onExit: (code: number) => void
}

export type Attachment = {
  history: Uint8Array
  flow: () => void
  detach: () => Promise<void>
}

const command = (name: string) => `plugin:eris-terminal|${name}`

export const shells = () => invoke<Shell[]>(command("shells"))

export const spawn = (spawn: SpawnOptions) =>
  invoke<number>(command("spawn"), { spawn })

export const write = (id: number, data: string) =>
  invoke(command("write"), { id, data })

export const resize = (id: number, cols: number, rows: number) =>
  invoke(command("resize"), { id, cols, rows })

export const kill = (id: number) => invoke(command("kill"), { id })

export const attach = async (
  id: number,
  { onData, onExit }: AttachOptions,
): Promise<Attachment> => {
  const output = new Channel<ArrayBuffer>()
  const exit = new Channel<number>()
  const held: Uint8Array[] = []
  let deliver = (data: Uint8Array) => {
    held.push(data)
  }

  output.onmessage = e => deliver(new Uint8Array(e))
  exit.onmessage = onExit

  const history = await invoke<ArrayBuffer>(command("attach"), {
    id,
    output,
    exit,
  })

  return {
    history: new Uint8Array(history),
    flow: () => {
      deliver = onData
      held.forEach(onData)
    },
    detach: () => invoke(command("detach"), { id, channel: output.id }),
  }
}
