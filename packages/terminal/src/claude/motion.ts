import { fade } from "svelte/transition"

const calm = () => document.documentElement.dataset.motion === "false"

export const appear = (node: Element) =>
  calm() ? { duration: 0 } : fade(node, { duration: 140 })
