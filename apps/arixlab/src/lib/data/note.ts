import calendar from "$lib/assets/note/calendar.webp"
import canvas from "$lib/assets/note/canvas.webp"
import editor from "$lib/assets/note/editor.webp"
import graph from "$lib/assets/note/graph.webp"
import palette from "$lib/assets/note/palette.webp"
import phoneCalendar from "$lib/assets/note/phone-calendar.webp"
import phoneNote from "$lib/assets/note/phone-note.webp"
import sync from "$lib/assets/note/sync.webp"
import todos from "$lib/assets/note/todos.webp"
import * as m from "$lib/paraglide/messages"

export const NOTE_REPO = "pleahmacaka/arixlab-note"

export const NOTE_SOURCE = `https://github.com/${NOTE_REPO}`

export const NOTE_RELEASES = `https://github.com/${NOTE_REPO}/releases`

export type Shot = { src: string; width: number; height: number }

// screenshots of the real app, rendered from a sample vault; sizes match the files
const SHOTS = {
  editor: { src: editor, width: 1600, height: 1000 },
  canvas: { src: canvas, width: 1260, height: 576 },
  graph: { src: graph, width: 1300, height: 828 },
  calendar: { src: calendar, width: 1300, height: 967 },
  todos: { src: todos, width: 1300, height: 1082 },
  sync: { src: sync, width: 1300, height: 1106 },
  palette: { src: palette, width: 1300, height: 923 },
  phoneNote: { src: phoneNote, width: 520, height: 1118 },
  phoneCalendar: { src: phoneCalendar, width: 520, height: 1118 },
} satisfies Record<string, Shot>

export const heroShot = SHOTS.editor

type Visual =
  | { kind: "shot"; shot: Shot }
  | { kind: "stack"; back: Shot; front: Shot }
  | { kind: "phones"; shots: [Shot, Shot] }
  | { kind: "eris" }

type Showcase = {
  id: string
  title: () => string
  body: () => string
  chips: () => string
  visual: Visual
}

export const showcase: Showcase[] = [
  {
    id: "canvas",
    title: m.note_feature_canvas,
    body: m.note_feature_canvas_body,
    chips: m.note_chips_canvas,
    visual: { kind: "shot", shot: SHOTS.canvas },
  },
  {
    id: "graph",
    title: m.note_feature_graph,
    body: m.note_feature_graph_body,
    chips: m.note_chips_graph,
    visual: { kind: "shot", shot: SHOTS.graph },
  },
  {
    id: "plan",
    title: m.note_feature_plan,
    body: m.note_feature_plan_body,
    chips: m.note_chips_plan,
    visual: { kind: "stack", back: SHOTS.calendar, front: SHOTS.todos },
  },
  {
    id: "sync",
    title: m.note_feature_sync,
    body: m.note_feature_sync_body,
    chips: m.note_chips_sync,
    visual: { kind: "shot", shot: SHOTS.sync },
  },
  {
    id: "eris",
    title: m.note_feature_eris,
    body: m.note_feature_eris_body,
    chips: m.note_chips_eris,
    visual: { kind: "eris" },
  },
  {
    id: "mobile",
    title: m.note_feature_mobile,
    body: m.note_feature_mobile_body,
    chips: m.note_chips_mobile,
    visual: { kind: "phones", shots: [SHOTS.phoneNote, SHOTS.phoneCalendar] },
  },
  {
    id: "palette",
    title: m.note_feature_palette,
    body: m.note_feature_palette_body,
    chips: m.note_chips_palette,
    visual: { kind: "shot", shot: SHOTS.palette },
  },
]

type Extra = { icon: string; title: () => string; body: () => string }

export const extras: Extra[] = [
  {
    icon: "lucide:eye",
    title: m.note_more_preview,
    body: m.note_more_preview_body,
  },
  {
    icon: "lucide:link-2",
    title: m.note_more_links,
    body: m.note_more_links_body,
  },
  {
    icon: "lucide:list-tree",
    title: m.note_more_outline,
    body: m.note_more_outline_body,
  },
  {
    icon: "lucide:layout-template",
    title: m.note_more_templates,
    body: m.note_more_templates_body,
  },
  {
    icon: "lucide:search",
    title: m.note_more_search,
    body: m.note_more_search_body,
  },
  {
    icon: "lucide:columns-2",
    title: m.note_more_splits,
    body: m.note_more_splits_body,
  },
  {
    icon: "lucide:code-xml",
    title: m.note_more_html,
    body: m.note_more_html_body,
  },
  {
    icon: "lucide:sun-moon",
    title: m.note_more_themes,
    body: m.note_more_themes_body,
  },
  {
    icon: "lucide:folder-open",
    title: m.note_more_files,
    body: m.note_more_files_body,
  },
]

export const chipsOf = (chips: () => string) => chips().split("|")
