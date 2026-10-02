export const LOGO_VIEWBOX = 48

export const logoParts = [
  {
    part: "body",
    d: "M6.780 24.000 L22.453 4.886 A20.500 25.000 0 0 1 22.453 43.114 Z",
    color: "#9E6ADD",
    lightColor: "#7E32DE",
  },
  {
    part: "blade",
    d: "M29.365 9.543 L41.220 24.000 L29.365 38.457 A23.500 28.000 0 0 0 29.365 9.543 Z",
    color: "#BAA3DB",
    lightColor: "#9E6ADD",
  },
] as const

export const logoSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}">${logoParts
    .map(part => `<path d="${part.d}" fill="${part.color}"/>`)
    .join("")}</svg>`
