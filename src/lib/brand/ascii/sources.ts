import { logoSvg } from "#lib/brand/logo.js"
import { cssColor } from "./glyphs"
import { type Painter, svgPainter } from "./raster"

export const logoPainter: Painter = (ctx, width, height) =>
  svgPainter(
    logoSvg(token => cssColor(document.documentElement, `--color-${token}`)),
  )(ctx, width, height)
