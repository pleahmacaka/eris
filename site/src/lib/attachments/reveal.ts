import type { Attachment } from "svelte/attachments"

export const reveal: Attachment<HTMLElement> = node => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches

  if (still || node.getBoundingClientRect().top < innerHeight) {
    return
  }

  node.dataset.reveal = "pending"

  const sight = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        node.dataset.reveal = "shown"
        sight.disconnect()
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  )

  sight.observe(node)

  return () => sight.disconnect()
}
