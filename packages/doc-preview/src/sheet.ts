import { type CellObject, read, utils, type WorkSheet } from "@e965/xlsx"

const CLASS = "eris-sheet"

const MAX_ROWS = 500

const MAX_COLS = 60

const STYLE = `
.${CLASS} {
  --line: color-mix(in srgb, currentColor 14%, transparent);
  --head: color-mix(in srgb, currentColor 6%, var(--doc-preview-bg, Canvas));
  display: flex;
  flex-direction: column;
  height: 100%;
  font: inherit;
  font-variant-numeric: tabular-nums;
}
.${CLASS}-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.375rem;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  flex: none;
}
.${CLASS}-tabs button {
  font: inherit;
  font-size: 0.8125rem;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  padding: 0.25rem 0.625rem;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0.7;
}
.${CLASS}-tabs button:hover { opacity: 1; }
.${CLASS}-tabs button[aria-selected="true"] {
  opacity: 1;
  background: var(--head);
  border-color: var(--line);
}
.${CLASS}-scroll { flex: 1; min-height: 0; overflow: auto; }
.${CLASS} table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.8125rem;
}
.${CLASS} th, .${CLASS} td {
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 0.125rem 0.5rem;
  max-width: 20rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.${CLASS} td.num { text-align: right; }
.${CLASS} th {
  position: sticky;
  background: var(--head);
  font-weight: 500;
  opacity: 1;
}
.${CLASS} thead th { top: 0; z-index: 1; text-align: center; }
.${CLASS} tbody th { left: 0; text-align: right; }
.${CLASS} thead th:first-child { left: 0; z-index: 2; }
.${CLASS}-note {
  flex: none;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  border-top: 1px solid var(--line);
  opacity: 0.7;
}
.${CLASS}-empty { padding: 1rem; font-size: 0.875rem; opacity: 0.55; }
.${CLASS}-thumb { height: auto; overflow: hidden; }
.${CLASS}-thumb table { width: 100%; table-layout: fixed; font-size: 0.625rem; }
.${CLASS}-thumb th, .${CLASS}-thumb td { padding: 0 0.25rem; }
.${CLASS}-thumb tbody th, .${CLASS}-thumb thead th:first-child { width: 1.75rem; }
`

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) => {
  const node = document.createElement(tag)

  node.className = className
  node.textContent = text

  return node
}

const isNumeric = (cell: CellObject | undefined) =>
  cell?.t === "n" || cell?.t === "d"

const buildTable = (sheet: WorkSheet, maxRows: number, maxCols: number) => {
  const table = element("table")
  const ref: unknown = sheet["!ref"]
  const fullRef: unknown = sheet["!fullref"]
  const hasCells = Object.keys(sheet).some(key => !key.startsWith("!"))

  if (typeof ref !== "string" || !hasCells) {
    return { table, rows: false, cols: false }
  }

  const range = utils.decode_range(ref)
  const full = typeof fullRef === "string" ? utils.decode_range(fullRef) : range
  const lastRow = Math.min(range.e.r, range.s.r + maxRows - 1)
  const lastCol = Math.min(range.e.c, range.s.c + maxCols - 1)
  const head = element("tr")

  head.append(element("th"))

  for (let c = range.s.c; c <= lastCol; c++) {
    head.append(element("th", "", utils.encode_col(c)))
  }

  const body = element("tbody")

  for (let r = range.s.r; r <= lastRow; r++) {
    const row = element("tr")

    row.append(element("th", "", utils.encode_row(r)))

    for (let c = range.s.c; c <= lastCol; c++) {
      const cell: CellObject | undefined = sheet[utils.encode_cell({ r, c })]
      const text = cell ? utils.format_cell(cell) : ""

      row.append(element("td", isNumeric(cell) ? "num" : "", text))
    }

    body.append(row)
  }

  const thead = element("thead")

  thead.append(head)
  table.append(thead, body)

  return { table, rows: lastRow < full.e.r, cols: lastCol < full.e.c }
}

const truncationNote = (rows: boolean, cols: boolean) => {
  if (rows && cols) {
    return `앞 ${MAX_ROWS}행, ${MAX_COLS}열만 표시`
  }

  if (rows) {
    return `앞 ${MAX_ROWS}행만 표시`
  }

  return cols ? `앞 ${MAX_COLS}열만 표시` : ""
}

const SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0xd0, 0xcf, 0x11, 0xe0],
]

const isContainer = (bytes: Uint8Array) =>
  SIGNATURES.some(signature => signature.every((b, i) => bytes[i] === b))

const decodeText = (bytes: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder("euc-kr").decode(bytes)
  }
}

const visibleSheets = (bytes: Uint8Array, sheetRows: number) => {
  const book = isContainer(bytes)
    ? read(bytes, { type: "array", sheetRows })
    : read(decodeText(bytes), { type: "string", sheetRows })
  const hidden = book.Workbook?.Sheets ?? []

  return book.SheetNames.filter((_, i) => !hidden[i]?.Hidden).map(name => ({
    name,
    sheet: book.Sheets[name],
  }))
}

const emptyNote = () => element("div", `${CLASS}-empty`, "데이터 없음")

const styled = (className: string) => {
  const root = element("div", className)
  const style = element("style", "", STYLE)

  root.append(style)

  return root
}

export const renderSheet = async (bytes: Uint8Array, host: HTMLElement) => {
  const sheets = visibleSheets(bytes, MAX_ROWS)
  const root = styled(CLASS)
  const tabs = element("div", `${CLASS}-tabs`)
  const scroll = element("div", `${CLASS}-scroll`)
  const note = element("div", `${CLASS}-note`)

  tabs.setAttribute("role", "tablist")

  const show = (index: number) => {
    const { table, rows, cols } = buildTable(
      sheets[index].sheet,
      MAX_ROWS,
      MAX_COLS,
    )
    scroll.replaceChildren(table.childElementCount ? table : emptyNote())
    scroll.scrollTo(0, 0)
    note.textContent = truncationNote(rows, cols)
    note.hidden = !note.textContent

    for (const [i, tab] of [...tabs.children].entries()) {
      tab.setAttribute("aria-selected", String(i === index))
    }
  }

  for (const [i, { name }] of sheets.entries()) {
    const tab = element("button", "", name)

    tab.type = "button"
    tab.setAttribute("role", "tab")
    tab.addEventListener("click", () => show(i))
    tabs.append(tab)
  }

  if (sheets.length > 1) {
    root.append(tabs)
  }

  root.append(scroll, note)
  host.replaceChildren(root)

  if (sheets.length) {
    show(0)
  } else {
    scroll.append(emptyNote())
    note.hidden = true
  }

  return () => host.replaceChildren()
}

export const sheetThumbnail = async (
  bytes: Uint8Array,
  host: HTMLElement,
  width: number,
) => {
  const [first] = visibleSheets(bytes, 20)
  const root = styled(`${CLASS} ${CLASS}-thumb`)

  root.style.width = `${width}px`

  if (first) {
    root.append(buildTable(first.sheet, 20, 8).table)
  }

  host.replaceChildren(root)

  return () => host.replaceChildren()
}
