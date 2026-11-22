import type { PluginCreator } from "tailwindcss/plugin"

type Metrics = { ascent: number; descent: number }

type Face = { weight: string; local: string[]; widthRatio: number }

type Fallback = { family: string; metrics: Metrics; faces: Face[] }

const INTER: Metrics = { ascent: 0.96875, descent: 0.24121 }

const PRETENDARD: Metrics = { ascent: 0.95215, descent: 0.24121 }

const ARIAL_BOLD = ["Arial Bold", "Arial-BoldMT"]

const ROBOTO_BOLD = ["Roboto Bold", "Roboto-Bold"]

// widthRatio is the measured advance width of the web font over the local font at that weight; a wrong value re-wraps text on font swap
const FALLBACKS: Fallback[] = [
  {
    family: "Inter Arial",
    metrics: INTER,
    faces: [
      { weight: "100 400", local: ["Arial"], widthRatio: 1.062 },
      { weight: "500", local: ["Arial"], widthRatio: 1.072 },
      { weight: "600 900", local: ARIAL_BOLD, widthRatio: 1.019 },
    ],
  },
  {
    family: "Inter Roboto",
    metrics: INTER,
    faces: [
      { weight: "100 400", local: ["Roboto"], widthRatio: 1.072 },
      { weight: "500", local: ["Roboto"], widthRatio: 1.083 },
      { weight: "600 900", local: ROBOTO_BOLD, widthRatio: 1.0855 },
    ],
  },
  {
    family: "Pretendard Arial",
    metrics: PRETENDARD,
    faces: [
      { weight: "100 400", local: ["Arial"], widthRatio: 0.9616 },
      { weight: "500", local: ["Arial"], widthRatio: 0.9696 },
      { weight: "600 900", local: ARIAL_BOLD, widthRatio: 0.9389 },
    ],
  },
  {
    family: "Pretendard Roboto",
    metrics: PRETENDARD,
    faces: [
      { weight: "100 400", local: ["Roboto"], widthRatio: 1.0077 },
      { weight: "500", local: ["Roboto"], widthRatio: 1.0161 },
      { weight: "600 900", local: ROBOTO_BOLD, widthRatio: 1.0111 },
    ],
  },
  {
    family: "Pretendard Malgun",
    metrics: PRETENDARD,
    faces: [
      { weight: "100 500", local: ["Malgun Gothic"], widthRatio: 0.8643 },
      {
        weight: "600 900",
        local: ["Malgun Gothic Bold", "MalgunGothicBold"],
        widthRatio: 0.8643,
      },
    ],
  },
  {
    family: "Pretendard Noto",
    metrics: PRETENDARD,
    faces: [
      {
        weight: "100 900",
        local: ["Noto Sans CJK KR", "NotoSansCJKkr-Regular"],
        widthRatio: 0.9395,
      },
    ],
  },
]

const percent = (ratio: number) => `${(ratio * 100).toFixed(2)}%`

const fallbackFonts: PluginCreator = ({ addBase }) => {
  addBase({
    "@font-face": FALLBACKS.flatMap(({ family, metrics, faces }) =>
      faces.map(face => ({
        "font-family": `"${family}"`,
        "font-weight": face.weight,
        src: face.local.map(name => `local("${name}")`).join(", "),
        "size-adjust": percent(face.widthRatio),
        "ascent-override": percent(metrics.ascent / face.widthRatio),
        "descent-override": percent(metrics.descent / face.widthRatio),
        "line-gap-override": "0%",
      })),
    ),
  })
}

export default fallbackFonts
