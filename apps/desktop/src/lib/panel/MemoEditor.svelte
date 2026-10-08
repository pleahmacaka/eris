<script lang="ts">
  import type { BlockLabels, CompletionSource, EditorView } from "@eris/live-editor"
  import { t } from "svelte-i18n"
  import { citationOf } from "$lib/data"
  import { notePages } from "$lib/native"

  const {
    text,
    references,
    onchange,
    onblur,
  }: {
    text: string
    references: boolean
    onchange: (text: string) => void
    onblur: () => void
  } = $props()

  const blockLabels = (): BlockLabels => ({
    text: $t("panel.event.blocks.text"),
    h1: $t("panel.event.blocks.h1"),
    h2: $t("panel.event.blocks.h2"),
    h3: $t("panel.event.blocks.h3"),
    todo: $t("panel.event.blocks.todo"),
    bullet: $t("panel.event.blocks.bullet"),
    number: $t("panel.event.blocks.number"),
    quote: $t("panel.event.blocks.quote"),
    code: $t("panel.event.blocks.code"),
    divider: $t("panel.event.blocks.divider"),
    date: $t("panel.event.blocks.date"),
  })

  const citations: CompletionSource = async context => {
    const typed = context.matchBefore(/\[\[[^\]\n]*/)

    if (!typed || !references) {
      return null
    }

    const found = await notePages(typed.text.slice(2)).catch(() => [])

    return {
      from: typed.from,
      filter: false,
      options: found.map(page => ({
        label: page.title,
        detail: page.path,
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          const closed = view.state.sliceDoc(to, to + 2) === "]]" ? 2 : 0
          const insert = citationOf(page.title, page.path)

          view.dispatch({
            changes: { from, to: to + closed, insert },
            selection: { anchor: from + insert.length },
          })
        },
      })),
    }
  }

  let closingMenu = false

  const mount = (host: HTMLElement) => {
    let view: EditorView | undefined
    let gone = false
    let unsaved = false

    import("@eris/live-editor").then(({ createLiveEditor, placeCaretAtEnd }) => {
      if (gone) {
        return
      }

      view = createLiveEditor({
        parent: host,
        doc: text,
        placeholder: $t("panel.event.writeNotes"),
        blocks: blockLabels(),
        completions: [citations],
        onChange: next => {
          unsaved = true
          onchange(next)
        },
        onBlur: () => {
          unsaved = false
          onblur()
        },
      })
      placeCaretAtEnd(view)
    })

    // closing the panel removes the editor without a blur, so pending text is saved here
    return () => {
      gone = true
      view?.destroy()

      if (unsaved) {
        onblur()
      }
    }
  }
</script>

<div
  {@attach mount}
  role="presentation"
  onkeydowncapture={e => {
    closingMenu = e.key === "Escape" && !!e.currentTarget.querySelector(".cm-tooltip-autocomplete")
  }}
  onkeydown={e => {
    if (closingMenu) {
      e.stopPropagation()
    }
  }}
  class="memo -mx-2 min-h-7 rounded-field bg-base-content/6 px-2 py-1 text-sm"
></div>
