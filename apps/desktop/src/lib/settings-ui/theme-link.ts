import {
  type Appearance,
  defaultAppearance,
  WINDOW_BACKGROUNDS,
} from "@eris/settings"

const SURFACE = ["inherit", "aura", "glass", "solid"]

const CHOICES: Partial<Record<keyof Appearance, string[]>> = {
  mode: ["dark", "light", "system"],
  background: ["aura", "glass", "solid"],
  dockBackground: SURFACE,
  ...Object.fromEntries(
    Object.values(WINDOW_BACKGROUNDS).map(key => [key, SURFACE]),
  ),
  density: ["compact", "cozy"],
}

const isField = (key: string): key is keyof Appearance =>
  key in defaultAppearance

const fits = (key: keyof Appearance, value: unknown) =>
  typeof value === typeof defaultAppearance[key] &&
  (typeof value !== "number" || Number.isFinite(value)) &&
  (!CHOICES[key] || CHOICES[key].includes(String(value)))

export const themeFromLink = (link: string) => {
  try {
    const url = new URL(link)
    const raw: unknown = JSON.parse(
      url.searchParams.get("appearance") ?? "null",
    )

    if (!raw || typeof raw !== "object") {
      return null
    }

    const appearance: Partial<Appearance> = Object.fromEntries(
      Object.entries(raw).filter(
        ([key, value]) => isField(key) && fits(key, value),
      ),
    )

    if (!Object.keys(appearance).length) {
      return null
    }

    return {
      name: url.searchParams.get("name")?.slice(0, 60) ?? "",
      appearance,
    }
  } catch {
    return null
  }
}
