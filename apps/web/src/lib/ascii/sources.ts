import { logoSvg } from "@eris/ui/logo"
import { getIcon } from "@iconify/svelte"
import { type Painter, svgPainter } from "./raster"

export const logoPainter: Painter = svgPainter(logoSvg())

export const applePainter: Painter = (ctx, width, height) => {
  const icon = getIcon("lucide:apple")

  if (!icon) {
    return
  }

  const markup = `<svg viewBox="0 0 ${icon.width} ${icon.height}">${icon.body}</svg>`

  return svgPainter(markup, 2)(ctx, width, height)
}
