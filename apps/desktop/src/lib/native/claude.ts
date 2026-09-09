import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export type ChatRect = { x: number; y: number; width: number; height: number }

export type ChatArea = {
  width: number
  height: number
  monitors: ChatRect[]
  home: number
}

export type Transcript = {
  id: string
  title: string
  modified: number
  messages: number
}

export type TranscriptMessage = { role: string; text: string }

export type ClaudeStart = {
  key: string
  cwd: string | null
  resume: string | null
  plain: boolean
  permissionMode: string
  model: string
  effort: string
  thinking: string
  autoCompact: string
  language: string
  budget: number
  systemPrompt: string
}

export const claudeWhich = () => invoke<string | null>("claude_which")

export const claudeStart = (options: ClaudeStart) =>
  invoke<void>("claude_start", { options })

export const claudeSend = (key: string, line: string) =>
  invoke<void>("claude_send", { key, line })

export const claudeStop = (key: string) => invoke<void>("claude_stop", { key })

export const claudeSessions = (cwd: string | null) =>
  invoke<Transcript[]>("claude_sessions", { cwd })

export const claudeTranscript = (cwd: string | null, id: string) =>
  invoke<TranscriptMessage[]>("claude_transcript", { cwd, id })

export const chatArea = () => invoke<ChatArea | null>("chat_area")

export const chatFrame = (frame: number[], rects: number[][]) =>
  invoke<void>("chat_frame", { frame, rects })

export const onChatToggle = (handler: () => void) =>
  listen("chat-toggle", () => handler())
