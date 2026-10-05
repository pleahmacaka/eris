import { syncNow } from "../sync/engine"
import { dirname } from "../vault/paths"
import { createFile, createFolder } from "../vault/vault.svelte"
import { layout, revealPanel } from "./layout.svelte"
import { openPath } from "./navigate"
import {
  closeTab,
  focusedPane,
  focusedTab,
  openView,
  splitPane,
} from "./workspace.svelte"

export type Command = {
  id: string
  label: string
  icon: string
  keys?: string
  run: () => unknown
}

export const EMPTY_CANVAS = `${JSON.stringify({ nodes: [], edges: [] }, null, 2)}\n`

export const currentFolder = () => {
  const path = focusedTab()?.path

  return path ? dirname(path) : ""
}

export const newNote = async (folder = currentFolder()) =>
  openPath(await createFile(folder, "제목 없음", ".md"))

export const newCanvas = async (folder = currentFolder()) =>
  openPath(await createFile(folder, "제목 없음", ".canvas", EMPTY_CANVAS))

export const newFolder = (parent = currentFolder()) =>
  createFolder(parent, "새 폴더")

export const closeActiveTab = () => {
  const pane = focusedPane()

  if (pane.active) {
    closeTab(pane, pane.active)
  }
}

export const commands = (): Command[] => [
  {
    id: "new-note",
    label: "새 노트",
    icon: "lucide:file-plus",
    keys: "Ctrl N",
    run: () => newNote(),
  },
  {
    id: "new-canvas",
    label: "새 캔버스",
    icon: "lucide:layout-dashboard",
    run: () => newCanvas(),
  },
  {
    id: "new-folder",
    label: "새 폴더",
    icon: "lucide:folder-plus",
    run: () => newFolder(),
  },
  {
    id: "new-template",
    label: "템플릿으로 새 노트",
    icon: "lucide:file-stack",
    run: () => {
      layout.palette = "new-template"
    },
  },
  {
    id: "insert-template",
    label: "템플릿 삽입",
    icon: "lucide:clipboard-paste",
    run: () => {
      layout.palette = "insert-template"
    },
  },
  {
    id: "open-file",
    label: "빠른 전환",
    icon: "lucide:file-search",
    keys: "Ctrl O",
    run: () => {
      layout.palette = "files"
    },
  },
  {
    id: "search",
    label: "검색",
    icon: "lucide:search",
    keys: "Ctrl Shift F",
    run: () => revealPanel("search"),
  },
  {
    id: "graph",
    label: "그래프 열기",
    icon: "lucide:waypoints",
    run: () => openView("graph"),
  },
  {
    id: "calendar",
    label: "캘린더 열기",
    icon: "lucide:calendar-days",
    run: () => openView("calendar"),
  },
  {
    id: "todos",
    label: "할 일 열기",
    icon: "lucide:list-checks",
    run: () => openView("todos"),
  },
  {
    id: "settings",
    label: "설정 열기",
    icon: "lucide:settings",
    keys: "Ctrl ,",
    run: () => openView("settings"),
  },
  {
    id: "split",
    label: "오른쪽으로 분할",
    icon: "lucide:columns-2",
    keys: "Ctrl \\",
    run: () => splitPane(focusedPane()),
  },
  {
    id: "close-tab",
    label: "탭 닫기",
    icon: "lucide:x",
    keys: "Ctrl W",
    run: closeActiveTab,
  },
  {
    id: "toggle-left",
    label: "왼쪽 패널 전환",
    icon: "lucide:panel-left",
    run: () => {
      layout.open.left = !layout.open.left
    },
  },
  {
    id: "toggle-right",
    label: "오른쪽 패널 전환",
    icon: "lucide:panel-right",
    run: () => {
      layout.open.right = !layout.open.right
    },
  },
  { id: "sync", label: "지금 동기화", icon: "lucide:refresh-cw", run: syncNow },
]
