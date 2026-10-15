<script lang="ts">
  import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager"
  import type { FitAddon, Terminal as Screen } from "ghostty-web"
  import { untrack } from "svelte"
  import { type Attachment, attach, resize, spawn, write } from "./pty"
  import { DEFAULT_FONT, fontStack, loadFont, prepare } from "./ready"
  import { terminalTheme } from "./theme"

  type Props = {
    shell: string
    cwd?: string | null
    pty?: number | null
    run?: string
    fontFamily?: string
    fontSize?: number
    active?: boolean
    shown?: boolean
    onexit?: (code: number) => void
    onpty?: (id: number) => void
    ontitle?: (title: string) => void
    oninput?: (data: string) => void
    class?: string
  }

  let {
    shell,
    cwd = null,
    pty = null,
    run,
    fontFamily = DEFAULT_FONT,
    fontSize = 14,
    active = true,
    shown = true,
    onexit,
    onpty,
    ontitle,
    oninput,
    class: className,
  }: Props = $props()

  let host = $state<HTMLDivElement>()
  let term = $state.raw<Screen>()
  let fit: FitAddon | undefined
  let attachment: Attachment | undefined

  const copy = () => {
    if (!term?.hasSelection()) {
      return
    }

    writeText(term.getSelection())
    term.clearSelection()
  }

  // an image clipboard has no text; Claude Code reads it on Alt+V under Windows and on Ctrl+V elsewhere, WSL included
  const imagePasteKey = () =>
    navigator.userAgent.includes("Windows") && !shell.startsWith("wsl:")
      ? "\x1bv"
      : "\x16"

  // ConPTY reads a lone ESC byte as the start of a sequence and merges it with the next key, so Escape goes as the win32-input-mode record Windows Terminal sends
  const ESCAPE_RECORD = "\x1b[27;1;27;1;0;1_\x1b[27;1;27;0;0;1_"

  const conpty = () =>
    navigator.userAgent.includes("Windows") && !shell.startsWith("serial:")

  const paste = async () => {
    const text = await readText().catch(() => "")

    if (text) {
      term?.paste(text.replaceAll("\r\n", "\r").replaceAll("\n", "\r"))
    } else {
      term?.input(imagePasteKey(), true)
    }
  }

  const latin = (e: KeyboardEvent) => {
    if (e.code.startsWith("Key")) {
      const letter = e.code.slice(3).toLowerCase()

      return e.shiftKey ? letter.toUpperCase() : letter
    }

    return e.key.length === 1 ? e.key : null
  }

  const keys = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey && !e.altKey && !e.metaKey
    const bare = !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey

    if (e.key === "Escape" && bare && conpty()) {
      term?.input(ESCAPE_RECORD, true)

      return true
    }

    if (ctrl && e.code === "KeyV") {
      paste()

      return true
    }

    if (ctrl && e.code === "KeyC" && (e.shiftKey || term?.hasSelection())) {
      copy()

      return true
    }

    const key = e.altKey && !e.ctrlKey && !e.metaKey ? latin(e) : null

    // ghostty-web sends Alt+key as the bare key, so TUI shortcuts such as Alt+V never arrive
    if (key) {
      term?.input(`\x1b${key}`, true)

      return true
    }

    return false
  }

  // keys an IME passes through outside a composition, like the space that commits Hangul, only arrive here
  const onbeforeinput = (e: InputEvent) => {
    if (e.inputType === "insertText" && !e.isComposing && e.data) {
      term?.input(e.data, true)
    }
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
    const start = untrack(() => ({ shell, cwd, pty, run, fontFamily, fontSize }))

    const open = async () => {
      await prepare(start.fontFamily, start.fontSize)

      const ghostty = await import("ghostty-web")

      if (disposed) {
        return
      }

      const screen = new ghostty.Terminal({
        fontFamily: fontStack(start.fontFamily),
        fontSize: start.fontSize,
        theme: terminalTheme(),
        cursorBlink: untrack(() => active),
      })

      fit = new ghostty.FitAddon()
      screen.loadAddon(fit)
      screen.open(node)
      fit.fit()
      fit.observeResize()
      screen.attachCustomKeyEventHandler(keys)
      screen.onTitleChange(title => ontitle?.(title))
      term = screen

      const live = {
        onData: (data: Uint8Array) => !disposed && screen.write(data),
        onExit: (code: number) => !disposed && onexit?.(code),
      }

      const id =
        start.pty ??
        (await spawn({
          shell: start.shell,
          cwd: start.cwd,
          cols: screen.cols,
          rows: screen.rows,
        }).catch((reason: unknown) => {
          screen.write(`\r\n${String(reason)}\r\n`)

          return null
        }))

      if (id === null) {
        return
      }

      onpty?.(id)

      const attached = await attach(id, live).catch(() => null)

      if (!attached) {
        live.onExit(1)

        return
      }

      if (disposed) {
        attached.detach()

        return
      }

      attachment = attached

      // ghostty answers queries inside write, so history replays before onData; it also throws on empty input
      if (attached.history.length > 0) {
        screen.write(attached.history)
      }

      resize(id, screen.cols, screen.rows)
      screen.onData(data => {
        write(id, data)
        oninput?.(data)
      })
      screen.onResize(size => resize(id, size.cols, size.rows))
      attached.flow()

      if (start.pty === null && start.run) {
        write(id, `${start.run}\r`)
      }
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
      attachment?.detach()
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
    if (term) {
      term.options.cursorBlink = active
    }
  })

  $effect(() => {
    const screen = term

    if (!screen) {
      return
    }

    if (shown) {
      screen["startRenderLoop"]()

      return
    }

    // ghostty-web redraws every frame until disposed and restarts the loop after each resize
    const pause = () => screen["cancelRenderLoop"]()
    const resized = screen.onResize(() => queueMicrotask(pause))

    pause()

    return () => resized.dispose()
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
  {onbeforeinput}
  onkeydown={e => e.stopPropagation()}
></div>
