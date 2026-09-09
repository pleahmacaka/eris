import { invoke } from "@tauri-apps/api/core"

export type UsageWindow = {
  used: number
  resetsAt: string | null
}

export type ClaudeUsage = {
  source: string
  updatedAt: string | null
  fiveHour: UsageWindow | null
  sevenDay: UsageWindow | null
}

export const claudeUsage = (path: string | null) =>
  invoke<ClaudeUsage | null>("claude_usage", { path })

export const usageBridgeInstalled = () =>
  invoke<boolean>("usage_bridge_installed")

export const installUsageBridge = (enable: boolean) =>
  invoke<void>("install_usage_bridge", { enable })
