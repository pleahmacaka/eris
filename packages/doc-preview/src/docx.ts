import { renderAsync } from "docx-preview"

const CLASS = "eris-docx"

const STYLE = `
:host { display: block; height: 100%; }
.${CLASS}-root { height: 100%; overflow: auto; }
.${CLASS}-wrapper {
  background: transparent;
  padding: 1rem;
  gap: 1rem;
  align-items: safe center;
}
.${CLASS}-wrapper > section.${CLASS} {
  margin-bottom: 0;
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent), 0 0.25rem 1rem rgb(0 0 0 / 0.12);
}
.${CLASS}-thumb { height: 100%; overflow: hidden; }
.${CLASS}-thumb .${CLASS}-wrapper { padding: 0; }
.${CLASS}-thumb section.${CLASS} ~ section.${CLASS} { display: none; }
.${CLASS}-thumb .${CLASS}-wrapper > section.${CLASS} { box-shadow: none; }
`

const mount = async (bytes: Uint8Array, host: HTMLElement, root: string) => {
  const shell = document.createElement("div")
  const shadow = shell.attachShadow({ mode: "open" })
  const container = document.createElement("div")
  const style = document.createElement("style")

  container.className = root
  shadow.append(container)
  host.replaceChildren(shell)

  await renderAsync(bytes, container, container, {
    className: CLASS,
    inWrapper: true,
    useBase64URL: true,
    renderComments: false,
  })

  style.textContent = STYLE
  shadow.append(style)

  const wrapper = container.querySelector<HTMLElement>(`.${CLASS}-wrapper`)
  const page = container.querySelector<HTMLElement>(`section.${CLASS}`)

  return { shell, container, wrapper, page }
}

export const renderDocx = async (bytes: Uint8Array, host: HTMLElement) => {
  const { container, wrapper, page } = await mount(bytes, host, `${CLASS}-root`)

  const padding = wrapper
    ? Number.parseFloat(getComputedStyle(wrapper).paddingLeft)
    : 0
  const needed = (page?.offsetWidth ?? 0) + padding * 2

  const fit = () => {
    if (wrapper) {
      const available = container.clientWidth

      wrapper.style.zoom = needed > available ? String(available / needed) : ""
    }
  }

  const observer = new ResizeObserver(fit)

  observer.observe(container)

  return () => {
    observer.disconnect()
    host.replaceChildren()
  }
}

export const docxThumbnail = async (
  bytes: Uint8Array,
  host: HTMLElement,
  width: number,
) => {
  const { shell, wrapper, page } = await mount(bytes, host, `${CLASS}-thumb`)
  const pageWidth = page?.offsetWidth ?? 0

  if (wrapper && page && pageWidth) {
    const pageHeight =
      Number.parseFloat(getComputedStyle(page).minHeight) ||
      pageWidth * Math.SQRT2
    const scale = width / pageWidth

    wrapper.style.zoom = String(scale)
    shell.style.width = `${width}px`
    shell.style.height = `${pageHeight * scale}px`
  }

  return () => host.replaceChildren()
}
