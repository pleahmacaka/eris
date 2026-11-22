import { describe, expect, test } from "bun:test"
import {
  loadThemeFamily,
  loadThemePreference,
  resolveColorScheme,
  resolveTheme,
  saveThemeFamily,
  saveThemePreference,
  THEME_FAMILY_KEY,
  THEME_KEY,
  THEME_PREFERENCES,
} from "./theme"
import {
  COLOR_SCHEMES,
  DEFAULT_THEME_FAMILY,
  THEME_FAMILY_IDS,
} from "./themeFamilies"

const memory = (
  preference: string | null = null,
  family: string | null = null,
) => {
  const map = new Map<string, string>()

  if (preference !== null) {
    map.set(THEME_KEY, preference)
  }

  if (family !== null) {
    map.set(THEME_FAMILY_KEY, family)
  }

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

const bootScript = async () => {
  const html = await Bun.file(new URL("../../app.html", import.meta.url)).text()
  const script = html
    .split("<script>")
    .map(chunk => chunk.split("</script>")[0] ?? "")
    .find(chunk => chunk.includes(THEME_KEY))

  if (script === undefined) {
    throw new Error("app.html has no theme script")
  }

  return script
}

const boot = (
  script: string,
  storage: ReturnType<typeof memory>,
  systemDark: boolean,
) => {
  const root = {
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
  }
  const meta = new Map<string, string>()

  new Function("localStorage", "matchMedia", "document", script)(
    storage,
    () => ({ matches: systemDark }),
    {
      documentElement: root,
      querySelector: () => ({
        setAttribute: (name: string, value: string) => {
          meta.set(name, value)
        },
      }),
    },
  )

  return {
    theme: root.dataset.theme,
    colorScheme: root.style.colorScheme,
    themeColor: meta.get("content"),
  }
}

describe("theme preference", () => {
  test("follows the system by default", () => {
    expect(loadThemePreference(memory())).toBe("system")
  })

  test("ignores an unknown stored value", () => {
    expect(loadThemePreference(memory("sepia"))).toBe("system")
  })

  test("persists every preference", () => {
    const storage = memory()

    for (const preference of THEME_PREFERENCES) {
      saveThemePreference(storage, preference)
      expect(storage.getItem(THEME_KEY)).toBe(preference)
      expect(loadThemePreference(storage)).toBe(preference)
    }
  })
})

describe("theme family", () => {
  test("starts with the default family", () => {
    expect(loadThemeFamily(memory())).toBe(DEFAULT_THEME_FAMILY)
  })

  test("ignores an unknown stored value", () => {
    expect(loadThemeFamily(memory(null, "sepia"))).toBe(DEFAULT_THEME_FAMILY)
  })

  test("persists every family without touching the stored mode", () => {
    const storage = memory("light")

    for (const family of THEME_FAMILY_IDS) {
      saveThemeFamily(storage, family)
      expect(storage.getItem(THEME_FAMILY_KEY)).toBe(family)
      expect(loadThemeFamily(storage)).toBe(family)
      expect(loadThemePreference(storage)).toBe("light")
    }
  })
})

describe("color scheme", () => {
  test("follows the system only for the system preference", () => {
    expect(resolveColorScheme("system", true)).toBe("dark")
    expect(resolveColorScheme("system", false)).toBe("light")
    expect(resolveColorScheme("dark", false)).toBe("dark")
    expect(resolveColorScheme("light", true)).toBe("light")
  })
})

describe("theme resolution", () => {
  test("keeps the theme names and colors the default family already used", () => {
    expect(resolveTheme("eris", "dark")).toEqual({
      name: "eris",
      themeColor: "#0d0b0f",
    })
    expect(resolveTheme("eris", "light")).toEqual({
      name: "eris-light",
      themeColor: "#fbf9fc",
    })
  })

  test("resolves every family and scheme to its own theme", () => {
    const names = THEME_FAMILY_IDS.flatMap(family =>
      COLOR_SCHEMES.map(scheme => resolveTheme(family, scheme).name),
    )

    expect(new Set(names).size).toBe(
      THEME_FAMILY_IDS.length * COLOR_SCHEMES.length,
    )
  })
})

describe("boot script", () => {
  test("applies the theme the store resolves", async () => {
    const script = await bootScript()

    for (const family of [null, ...THEME_FAMILY_IDS, "sepia", "toString"]) {
      for (const preference of [null, ...THEME_PREFERENCES, "sepia"]) {
        for (const systemDark of [true, false]) {
          const scheme = resolveColorScheme(
            loadThemePreference(memory(preference, family)),
            systemDark,
          )
          const theme = resolveTheme(
            loadThemeFamily(memory(preference, family)),
            scheme,
          )

          expect(boot(script, memory(preference, family), systemDark)).toEqual({
            theme: theme.name,
            colorScheme: scheme,
            themeColor: theme.themeColor,
          })
        }
      }
    }
  })
})
