import type { Mode, Tool } from "./support"

export type CommunityLang = "en" | "ko"

export type Surface = "desktop" | "files" | "terminal"

export type CommunityCopy = {
  title: string
  lead: string
  home: string
  languages: string
  search: string
  anyTool: string
  anyMode: string
  modes: Record<Mode, string>
  tags: string
  allTags: string
  clear: string
  count: (n: number) => string
  empty: string
  by: (name: string) => string
  supports: string
  tools: Record<Tool, string>
  surfaces: Record<Surface, string>
  previewUnavailable: string
  back: string
  apply: string
  applyHint: string
  copyJson: string
  copied: string
}

const en: CommunityCopy = {
  title: "Eris themes",
  lead: "Themes that ship with Eris, previewed live on the real Eris surfaces.",
  home: "Eris home",
  languages: "Languages",
  search: "Search themes",
  anyTool: "Any tool",
  anyMode: "Any mode",
  modes: { dark: "Dark", light: "Light" },
  tags: "Tags",
  allTags: "All",
  clear: "Clear filters",
  count: n => `${n} ${n === 1 ? "theme" : "themes"}`,
  empty: "No matching themes",
  by: name => `by ${name}`,
  supports: "Works with",
  tools: {
    eris: "Eris launcher and dock",
    files: "Eris Files",
    terminal: "Eris Terminal",
  },
  surfaces: {
    desktop: "Launcher and dock",
    files: "Files",
    terminal: "Terminal",
  },
  previewUnavailable: "Live preview is not configured for this site.",
  back: "All themes",
  apply: "Apply in Eris",
  applyHint: "Opens Eris on this PC and asks before applying.",
  copyJson: "Copy JSON",
  copied: "Copied",
}

const ko: CommunityCopy = {
  title: "Eris 테마",
  lead: "Eris에 포함된 테마를 실제 Eris 화면으로 미리 봅니다.",
  home: "Eris 홈",
  languages: "언어",
  search: "테마 검색",
  anyTool: "모든 도구",
  anyMode: "모든 모드",
  modes: { dark: "어두운 모드", light: "밝은 모드" },
  tags: "태그",
  allTags: "전체",
  clear: "필터 초기화",
  count: n => `테마 ${n}개`,
  empty: "조건에 맞는 테마 없음",
  by: name => `${name} 제작`,
  supports: "지원 도구",
  tools: {
    eris: "Eris 런처와 독",
    files: "Eris Files",
    terminal: "Eris Terminal",
  },
  surfaces: {
    desktop: "런처와 독",
    files: "Files",
    terminal: "Terminal",
  },
  previewUnavailable:
    "이 사이트에는 실시간 미리 보기가 설정되어 있지 않습니다.",
  back: "전체 테마",
  apply: "Eris에 적용",
  applyHint: "이 PC의 Eris를 열고 적용 전에 확인합니다.",
  copyJson: "JSON 복사",
  copied: "복사 완료",
}

export const copy: Record<CommunityLang, CommunityCopy> = { en, ko }
