import { Channel, invoke } from "@tauri-apps/api/core"

export type Shell = { id: string; name: string }

export type PtyOptions = {
  shell: string
  cwd?: string | null
  cols: number
  rows: number
  onData: (data: Uint8Array) => void
  onExit: (code: number) => void
}

export type Pty = {
  id: number
  write: (data: string) => Promise<void>
  resize: (cols: number, rows: number) => Promise<void>
  kill: () => Promise<void>
}

const command = (name: string) => `plugin:eris-terminal|${name}`

export const shells = () => invoke<Shell[]>(command("shells"))

export const spawn = async ({
  shell,
  cwd = null,
  cols,
  rows,
  onData,
  onExit,
}: PtyOptions): Promise<Pty> => {
  const output = new Channel<ArrayBuffer>()
  const exit = new Channel<number>()

  output.onmessage = e => onData(new Uint8Array(e))
  exit.onmessage = onExit

  const id = await invoke<number>(command("spawn"), {
    spawn: { shell, cwd, cols, rows },
    output,
    exit,
  })

  return {
    id,
    write: data => invoke(command("write"), { id, data }),
    resize: (cols, rows) => invoke(command("resize"), { id, cols, rows }),
    kill: () => invoke(command("kill"), { id }),
  }
}
