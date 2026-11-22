export const REPO = "https://github.com/pleahmacaka/eris"

export const RELEASES = `${REPO}/releases/latest`

export const ARIXLAB = "https://arixlab.com"

export const SCREEN_IDS = [
  "chat",
  "voice",
  "friends",
  "switcher",
  "roles",
  "login",
] as const

export type ScreenId = (typeof SCREEN_IDS)[number]

export const FEATURE_IDS = [
  "homeserver",
  "spaces",
  "dms",
  "timeline",
  "voice",
  "roles",
  "themes",
  "input",
  "languages",
] as const

export type FeatureId = (typeof FEATURE_IDS)[number]

export const NETWORK_IDS = [
  "protocol",
  "homeserver",
  "interop",
  "source",
] as const

export type NetworkId = (typeof NETWORK_IDS)[number]

export const FAQ_IDS = [
  "what",
  "account",
  "price",
  "platforms",
  "voice",
  "interop",
  "encryption",
] as const

export const INSTALLERS = [
  { id: "windows", name: "Windows", formats: [".msi", ".exe"] },
  { id: "linux", name: "Linux", formats: [".AppImage", ".deb"] },
  { id: "android", name: "Android", formats: [".apk"] },
] as const

export type PlatformId = (typeof INSTALLERS)[number]["id"] | "web"
