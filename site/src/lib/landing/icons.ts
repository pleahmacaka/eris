import type { NetworkId, PlatformId, ScreenId } from "./content"

export const SCREEN_ICONS: Record<ScreenId, string> = {
  chat: "lucide:messages-square",
  voice: "lucide:audio-lines",
  friends: "lucide:users",
  switcher: "lucide:search",
  roles: "lucide:shield-check",
  login: "lucide:log-in",
}

export const NETWORK_ICONS: Record<NetworkId, string> = {
  protocol: "lucide:waypoints",
  homeserver: "lucide:server",
  interop: "lucide:blocks",
  source: "lucide:code-xml",
}

export const PLATFORM_ICONS: Record<PlatformId, string> = {
  windows: "mdi:microsoft-windows",
  linux: "mdi:linux",
  android: "mdi:android",
  web: "lucide:globe",
}
