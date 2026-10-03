const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function reveal(node: HTMLElement, index = 0) {
  if (reduced()) {
    node.dataset.reveal = "in"
    return
  }

  node.style.transitionDelay = `${index * 70}ms`

  const observer = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }

        node.dataset.reveal = "in"
        observer.disconnect()
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  )

  observer.observe(node)

  return {
    destroy() {
      observer.disconnect()
    },
  }
}
