import { logoSvg } from "@eris/ui/logo"
import { type Painter, svgPainter } from "./raster"

export const logoPainter: Painter = svgPainter(logoSvg())
