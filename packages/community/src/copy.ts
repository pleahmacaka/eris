import type { Tool } from "./support"

export type CommunityLang = "en" | "ko"

export type Surface = "desktop" | "files" | "terminal"

export type CommunityCopy = {
  title: string
  lead: string
  home: string
  languages: string
  submit: string
  apply: string
  preview: string
  previewing: string
  previewUnavailable: string
  copyJson: string
  copied: string
  author: (name: string) => string
  supports: string
  tools: Record<Tool, string>
  surfaces: Record<Surface, string>
}

const en: CommunityCopy = {
  title: "Community themes",
  lead: "Themes shared by Eris users. Preview one on the real Eris surfaces, then take its JSON.",
  home: "Eris home",
  languages: "Languages",
  submit: "Submit a theme",
  apply: "Set the same values in Settings, Appearance.",
  preview: "Preview",
  previewing: "Previewing",
  previewUnavailable: "Live preview is not configured for this site.",
  copyJson: "Copy JSON",
  copied: "Copied",
  author: name => `by ${name}`,
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
}

const ko: CommunityCopy = {
  title: "커뮤니티 테마",
  lead: "Eris 사용자가 공유한 테마입니다. 실제 Eris 화면에서 미리 보고 JSON을 가져가세요.",
  home: "Eris 홈",
  languages: "언어",
  submit: "테마 제출",
  apply: "설정의 모양 항목에서 같은 값을 적용하세요.",
  preview: "미리 보기",
  previewing: "미리 보는 중",
  previewUnavailable:
    "이 사이트에는 실시간 미리 보기가 설정되어 있지 않습니다.",
  copyJson: "JSON 복사",
  copied: "복사 완료",
  author: name => `${name} 제작`,
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
}

export const copy: Record<CommunityLang, CommunityCopy> = { en, ko }
