<script lang="ts">
  import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager"
  import { FitAddon, Terminal as Screen } from "ghostty-web"
  import { untrack } from "svelte"
  import { type Pty, spawn } from "./pty"
  import { DEFAULT_FONT, fontStack, loadFont, prepare } from "./ready"
  import { terminalTheme } from "./theme"

  type Props = {
    shell: string
    cwd?: string | null
    fontFamily?: string
    fontSize?: number
    active?: boolean
    onexit?: (code: number) => void
    ontitle?: (title: string) => void
    class?: string
  }

  let {
    shell,
    cwd = null,
    fontFamily = DEFAULT_FONT,
    fontSize = 14,
    active = true,
    onexit,
    ontitle,
    class: className,
  }: Props = $props()

  let host = $state<HTMLDivElement>()
  let term = $state.raw<Screen>()
  let fit: FitAddon | undefined
  let pty: Pty | undefined

  export const focus = () => term?.focus()

  export const kill = () => pty?.kill()

  const copy = () => {
    if (!term?.hasSelection()) {
      return
    }

    writeText(term.getSelection())
    term.clearSelection()
  }

  const paste = async () => {
    const text = await readText().catch(() => "")

    if (text) {
      term?.paste(text.replaceAll("\r\n", "\r").replaceAll("\n", "\r"))
    }
  }

  const keys = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey && !e.altKey && !e.metaKey

    if (ctrl && e.code === "KeyV") {
      paste()

      return true
    }

    if (ctrl && e.code === "KeyC" && (e.shiftKey || term?.hasSelection())) {
      copy()

      return true
    }

    return false
  }

  const oncontextmenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (term?.hasSelection()) {
      copy()
    } else {
      paste()
    }
  }

  $effect(() => {
    const node = host

    if (!node) {
      return
    }

    let disposed = false
    const start = untrack(() => ({ shell, cwd, fontFamily, fontSize }))

    const open = async () => {
      await prepare(start.fontFamily, start.fontSize)

      if (disposed) {
        return
      }

      const screen = new Screen({
        fontFamily: fontStack(start.fontFamily),
        fontSize: start.fontSize,
        theme: terminalTheme(),
        cursorBlink: true,
      })

      fit = new FitAddon()
      screen.loadAddon(fit)
      screen.open(node)
      fit.fit()
      fit.observeResize()
      screen.attachCustomKeyEventHandler(keys)
      screen.onTitleChange(title => ontitle?.(title))
      term = screen

      const session = await spawn({
        shell: start.shell,
        cwd: start.cwd,
        cols: screen.cols,
        rows: screen.rows,
        onData: data => screen.write(data),
        onExit: code => {
          if (!disposed) {
            onexit?.(code)
          }
        },
      }).catch((reason: unknown) => {
        screen.write(`\r\n${String(reason)}\r\n`)
      })

      if (!session || disposed) {
        session?.kill()

        return
      }

      pty = session
      screen.onData(data => session.write(data))
      screen.onResize(size => session.resize(size.cols, size.rows))
    }

    open()

    const recolor = new MutationObserver(() => {
      term?.renderer?.setTheme(terminalTheme())
    })

    recolor.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode", "style"],
    })

    return () => {
      disposed = true
      recolor.disconnect()
      pty?.kill()
      fit?.dispose()
      term?.dispose()
    }
  })

  $effect(() => {
    const screen = term
    const family = fontFamily
    const size = fontSize

    if (!screen) {
      return
    }

    loadFont(family, size).then(() => {
      screen.options.fontFamily = fontStack(family)
      screen.options.fontSize = size
      fit?.fit()
    })
  })

  $effect(() => {
    if (active && term) {
      fit?.fit()
      term.focus()
    }
  })
</script>

<div
  bind:this={host}
  role="textbox"
  tabindex="0"
  class={["size-full overflow-hidden caret-transparent", className]}
  oncontextmenucapture={oncontextmenu}
  onkeydown={e => e.stopPropagation()}
></div>
