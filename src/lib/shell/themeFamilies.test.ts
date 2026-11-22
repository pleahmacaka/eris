import { describe, expect, test } from "bun:test"
import {
  COLOR_SCHEMES,
  contrast,
  DEFAULT_THEME_FAMILY,
  dimmedText,
  isHex,
  READABLE_CONTRAST,
  THEME_FAMILIES,
  THEME_FAMILY_IDS,
  THEME_TOKENS,
  type ThemeToken,
  themeName,
  themeRules,
} from "./themeFamilies"

const SURFACES: ThemeToken[] = ["base-100", "base-200", "base-300"]

const FILLS = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "info",
  "success",
  "warning",
  "error",
] as const

const TEXT_ROLES: ThemeToken[] = [
  "primary",
  "info",
  "success",
  "warning",
  "error",
]

const VARIANTS = THEME_FAMILY_IDS.flatMap(family =>
  COLOR_SCHEMES.map(scheme => ({
    name: themeName(family, scheme),
    scheme,
    palette: THEME_FAMILIES[family][scheme],
  })),
)

const unreadable = (
  pairs: (token: ThemeToken) => [ThemeToken, ThemeToken][],
  tokens: readonly ThemeToken[],
) =>
  VARIANTS.flatMap(({ name, palette }) =>
    tokens.flatMap(token =>
      pairs(token)
        .filter(
          ([ink, surface]) =>
            contrast(palette[ink], palette[surface]) < READABLE_CONTRAST,
        )
        .map(([ink, surface]) => `${name}: ${ink} on ${surface}`),
    ),
  )

describe("theme families", () => {
  test("name dark variants after the family and light variants with a suffix", () => {
    expect(themeName("dracula", "dark")).toBe("dracula")
    expect(themeName("dracula", "light")).toBe("dracula-light")
  })

  test("define every token as a hex color in both variants", () => {
    const invalid = VARIANTS.flatMap(({ name, palette }) =>
      THEME_TOKENS.filter(token => !isHex(palette[token])).map(
        token => `${name}: ${token}`,
      ),
    )

    expect(VARIANTS.length).toBe(THEME_FAMILY_IDS.length * 2)
    expect(invalid).toEqual([])
  })

  test("keep body text readable on every surface", () => {
    expect(
      unreadable(surface => [["base-content", surface]], SURFACES),
    ).toEqual([])
  })

  test("keep button text readable on every fill", () => {
    expect(
      unreadable(fill => [[`${fill}-content` as ThemeToken, fill]], FILLS),
    ).toEqual([])
  })

  test("keep default button text readable on the neutral fill", () => {
    expect(unreadable(fill => [["base-content", fill]], ["neutral"])).toEqual(
      [],
    )
  })

  test("keep the primary and status colors readable as text", () => {
    expect(unreadable(role => [[role, "base-100"]], TEXT_ROLES)).toEqual([])
  })
})

describe("dimmed text tokens", () => {
  test("stay readable on base-100 and base-200 in every variant", () => {
    const failures = VARIANTS.flatMap(({ name, palette }) =>
      (["muted", "subtle"] as const).flatMap(level =>
        (["base-100", "base-200"] as const)
          .map(surface => ({
            surface,
            ratio: contrast(dimmedText(palette, level), palette[surface]),
          }))
          .filter(({ ratio }) => ratio < READABLE_CONTRAST)
          .map(
            ({ surface, ratio }) =>
              `${name}: ${level} on ${surface} ${ratio.toFixed(2)}`,
          ),
      ),
    )

    expect(failures).toEqual([])
  })

  test("dim subtle text at least as far as muted text", () => {
    for (const { palette } of VARIANTS) {
      const base = palette["base-100"]
      expect(contrast(dimmedText(palette, "subtle"), base)).toBeLessThanOrEqual(
        contrast(dimmedText(palette, "muted"), base),
      )
      expect(contrast(dimmedText(palette, "muted"), base)).toBeLessThan(
        contrast(palette["base-content"], base),
      )
    }
  })
})

describe("generated theme rules", () => {
  const rules = Object.entries(themeRules())

  test("cover every theme with its scheme and tokens", () => {
    for (const { name, scheme, palette } of VARIANTS) {
      const matches = rules.filter(([selector]) =>
        selector.split(",").includes(`[data-theme="${name}"]`),
      )

      expect(matches.length).toBe(1)
      expect(matches[0]?.[1]["color-scheme"]).toBe(scheme)

      for (const token of THEME_TOKENS) {
        expect(matches[0]?.[1][`--color-${token}`]).toBe(palette[token])
      }
    }
  })

  test("fall back to the default dark theme", () => {
    expect(
      rules
        .map(([selector]) => selector)
        .filter(selector => selector.includes(":where(:root)")),
    ).toEqual([
      `:where(:root),[data-theme="${themeName(DEFAULT_THEME_FAMILY, "dark")}"]`,
    ])
  })

  test("set the same properties in every theme so a nested preview inherits none", () => {
    const [first, ...rest] = rules.map(([, declarations]) =>
      Object.keys(declarations),
    )

    for (const properties of rest) {
      expect(properties).toEqual(first ?? [])
    }
  })
})
