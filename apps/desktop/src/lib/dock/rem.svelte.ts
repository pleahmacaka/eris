import { rootRem } from "@eris/ui"

const root = $state({ fontSize: rootRem() })

new MutationObserver(() => {
  root.fontSize = rootRem()
}).observe(document.documentElement, { attributeFilter: ["style"] })

export const rootFontSize = () => root.fontSize

export const rem = (px: number) => `${px / root.fontSize}rem`
