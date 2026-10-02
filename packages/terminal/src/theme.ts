import type { ITheme } from "ghostty-web"

type Palette = Record<keyof ITheme, string>

const ink = (percent: number) =>
  `color-mix(in oklch, var(--color-base-content) ${percent}%, var(--color-base-100))`

const brighter = (color: string) =>
  `color-mix(in oklch, ${color}, var(--color-base-content) 22%)`

const tones = (light: boolean) => ({
  black: ink(light ? 100 : 26),
  brightBlack: ink(light ? 62 : 52),
  white: ink(light ? 34 : 84),
  brightWhite: ink(light ? 18 : 100),
  magenta: light ? "oklch(52% 0.18 330)" : "oklch(74% 0.16 330)",
  cyan: light ? "oklch(54% 0.11 200)" : "oklch(80% 0.11 200)",
})

const css = (light: boolean): Palette => {
  const tone = tones(light)
  const named = {
    red: "var(--color-error)",
    green: "var(--color-success)",
    yellow: "var(--color-warning)",
    blue: "var(--color-info)",
    magenta: tone.magenta,
    cyan: tone.cyan,
  }

  return {
    foreground: "var(--color-base-content)",
    background: "var(--color-base-100)",
    cursor: "var(--color-primary)",
    cursorAccent: "var(--color-primary-content)",
    selectionBackground:
      "color-mix(in oklch, var(--color-primary) 38%, var(--color-base-100))",
    selectionForeground: "var(--color-base-content)",
    black: tone.black,
    white: tone.white,
    brightBlack: tone.brightBlack,
    brightWhite: tone.brightWhite,
    ...named,
    brightRed: brighter(named.red),
    brightGreen: brighter(named.green),
    brightYellow: brighter(named.yellow),
    brightBlue: brighter(named.blue),
    brightMagenta: brighter(named.magenta),
    brightCyan: brighter(named.cyan),
  }
}

const hex = (channel: number) => channel.toString(16).padStart(2, "0")

export const terminalTheme = (): ITheme => {
  const light = document.documentElement.dataset.mode === "light"
  const probe = document.createElement("span")
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })

  canvas.width = 1
  canvas.height = 1
  probe.hidden = true
  document.body.append(probe)

  const resolve = (color: string) => {
    probe.style.color = color

    if (!context) {
      return "#000000"
    }

    context.clearRect(0, 0, 1, 1)
    context.fillStyle = getComputedStyle(probe).color
    context.fillRect(0, 0, 1, 1)

    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data

    return `#${hex(red)}${hex(green)}${hex(blue)}`
  }

  const theme = Object.fromEntries(
    Object.entries(css(light)).map(([key, color]) => [key, resolve(color)]),
  )

  probe.remove()

  return theme
}
