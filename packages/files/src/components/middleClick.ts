const hold = (e: MouseEvent) => {
  if (e.button === 1) {
    e.preventDefault()
  }
}

// Chromium starts autoscroll from the press itself, so both the pointer and the mouse press are cancelled
export const middleClick = (open: () => void) => (node: HTMLElement) => {
  const fire = (e: MouseEvent) => e.button === 1 && open()

  node.addEventListener("pointerdown", hold)
  node.addEventListener("mousedown", hold)
  node.addEventListener("auxclick", fire)

  return () => {
    node.removeEventListener("pointerdown", hold)
    node.removeEventListener("mousedown", hold)
    node.removeEventListener("auxclick", fire)
  }
}
