import { syntaxTree } from "@codemirror/language"
import type { EditorState, Range } from "@codemirror/state"
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view"

class Bullet extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const dot = document.createElement("span")

    dot.className = "cm-bullet"
    dot.textContent = "•"

    return dot
  }
}

class Task extends WidgetType {
  constructor(readonly done: boolean) {
    super()
  }

  eq(other: Task) {
    return other.done === this.done
  }

  toDOM() {
    const box = document.createElement("input")

    box.type = "checkbox"
    box.className = "cm-task checkbox checkbox-xs checkbox-primary"
    box.checked = this.done

    return box
  }

  ignoreEvent() {
    return false
  }
}

class Rule extends WidgetType {
  eq() {
    return true
  }

  toDOM() {
    const line = document.createElement("span")

    line.className = "cm-rule"

    return line
  }
}

const hidden = Decoration.replace({})

const activeLines = (view: EditorView) => {
  const lines = new Set<number>()

  if (!view.hasFocus) {
    return lines
  }

  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number
    const last = view.state.doc.lineAt(range.to).number

    for (let n = first; n <= last; n++) {
      lines.add(n)
    }
  }

  return lines
}

const spaceAfter = (state: EditorState, pos: number) =>
  state.doc.sliceString(pos, pos + 1) === " " ? 1 : 0

const build = (view: EditorView): DecorationSet => {
  const { state } = view
  const active = activeLines(view)
  const ranges: Range<Decoration>[] = []
  const lineOf = (pos: number) => state.doc.lineAt(pos)

  const hide = (from: number, to: number) => {
    if (from < to) {
      ranges.push(hidden.range(from, to))
    }
  }

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: node => {
        const heading = /^ATXHeading(\d)$/.exec(node.name)

        if (heading) {
          ranges.push(
            Decoration.line({ class: `cm-h${heading[1]}` }).range(
              lineOf(node.from).from,
            ),
          )
        }

        if (node.name === "Blockquote") {
          for (let pos = node.from; pos <= node.to; ) {
            const line = lineOf(pos)

            ranges.push(Decoration.line({ class: "cm-quote" }).range(line.from))
            pos = line.to + 1
          }
        }

        if (active.has(lineOf(node.from).number)) {
          return
        }

        const parent = node.node.parent?.name ?? ""

        switch (node.name) {
          case "HeaderMark":
            if (parent.startsWith("ATXHeading")) {
              hide(node.from, node.to + spaceAfter(state, node.to))
            }
            break
          case "EmphasisMark":
          case "StrikethroughMark":
            hide(node.from, node.to)
            break
          case "CodeMark":
            if (parent === "InlineCode") {
              hide(node.from, node.to)
            }
            break
          case "QuoteMark":
            hide(node.from, node.to + spaceAfter(state, node.to))
            break
          case "LinkMark":
          case "URL":
            if (parent === "Link") {
              hide(node.from, node.to)
            }
            break
          case "ListMark":
            if (node.node.parent?.getChild("Task")) {
              hide(node.from, node.to + spaceAfter(state, node.to))
            } else if (node.node.parent?.parent?.name === "BulletList") {
              ranges.push(
                Decoration.replace({ widget: new Bullet() }).range(
                  node.from,
                  node.to,
                ),
              )
            }
            break
          case "TaskMarker":
            ranges.push(
              Decoration.replace({
                widget: new Task(/x/i.test(state.sliceDoc(node.from, node.to))),
              }).range(node.from, node.to),
            )
            break
          case "HorizontalRule":
            ranges.push(
              Decoration.replace({ widget: new Rule() }).range(
                node.from,
                node.to,
              ),
            )
            break
        }
      },
    })
  }

  return Decoration.set(ranges, true)
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = build(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged
      ) {
        this.decorations = build(update.view)
      }
    }
  },
  { decorations: v => v.decorations },
)
