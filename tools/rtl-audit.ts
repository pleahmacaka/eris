import { Glob } from "bun"

const CLASS_REPLACEMENTS: [string, string][] = [
  ["ml-", "ms-"],
  ["mr-", "me-"],
  ["pl-", "ps-"],
  ["pr-", "pe-"],
  ["left-", "start-"],
  ["right-", "end-"],
  ["border-l", "border-s"],
  ["border-r", "border-e"],
  ["rounded-tl", "rounded-ss"],
  ["rounded-tr", "rounded-se"],
  ["rounded-bl", "rounded-es"],
  ["rounded-br", "rounded-ee"],
  ["rounded-l", "rounded-s"],
  ["rounded-r", "rounded-e"],
  ["text-left", "text-start"],
  ["text-right", "text-end"],
  ["float-left", "float-start"],
  ["float-right", "float-end"],
  ["scroll-ml-", "scroll-ms-"],
  ["scroll-mr-", "scroll-me-"],
  ["scroll-pl-", "scroll-ps-"],
  ["scroll-pr-", "scroll-pe-"],
  ["translate-x-", "rtl:-translate-x-* when the shift is directional"],
]

const CSS_REPLACEMENTS: [string, string][] = [
  ["margin-left:", "margin-inline-start:"],
  ["margin-right:", "margin-inline-end:"],
  ["padding-left:", "padding-inline-start:"],
  ["padding-right:", "padding-inline-end:"],
  ["border-left:", "border-inline-start:"],
  ["border-right:", "border-inline-end:"],
  ["left:", "inset-inline-start:"],
  ["right:", "inset-inline-end:"],
]

const DIRECTIONAL_ICON_WORDS = ["left", "right"]

const utility = (token: string) => {
  const base = token.split(":").at(-1) ?? token
  return base.replace(/^[!-]+/, "")
}

const SPACING_KEYWORDS = ["px", "auto", "full"]

const isSpacingValue = (value: string) =>
  SPACING_KEYWORDS.includes(value) || "0123456789[(".includes(value.charAt(0))

const matchesUtility = (base: string, physical: string) =>
  physical.endsWith("-")
    ? base.startsWith(physical) && isSpacingValue(base.slice(physical.length))
    : base === physical || base.startsWith(`${physical}-`)

const classReplacement = (token: string) => {
  const base = utility(token)
  return CLASS_REPLACEMENTS.find(([physical]) =>
    matchesUtility(base, physical),
  )?.[1]
}

const MIRRORED = "rtl:-scale-x-100"

const iconReplacement = (token: string, line: string) =>
  token.startsWith("lucide:") &&
  !line.includes(MIRRORED) &&
  DIRECTIONAL_ICON_WORDS.some(word => token.includes(word))
    ? `add ${MIRRORED} to the icon if it points along the reading direction`
    : undefined

const cssReplacement = (token: string) =>
  CSS_REPLACEMENTS.find(([physical]) => token === physical)?.[1]

const tokens = (line: string) =>
  line.split(/[\s"'`{}(),[\]]+/).filter(token => token.length > 0)

const findings: string[] = []
const files = new Glob("src/**/*.{svelte,ts,css}")

for await (const path of files.scan(".")) {
  if (path.endsWith(".test.ts")) {
    continue
  }

  const css = path.endsWith(".css")
  const lines = (await Bun.file(path).text()).split("\n")

  lines.forEach((line, index) => {
    for (const token of tokens(line)) {
      const replacement = css
        ? cssReplacement(token)
        : (classReplacement(token) ?? iconReplacement(token, line))

      if (replacement) {
        findings.push(`${path}:${index + 1}  ${token}  ->  ${replacement}`)
      }
    }
  })
}

console.log(findings.join("\n"))
console.log(`\n${findings.length} physical-direction usages`)
process.exitCode = findings.length > 0 ? 1 : 0
