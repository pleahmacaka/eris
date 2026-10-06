import type { Background, DockBackground, ThemeMode } from "@eris/settings"
import type { Mode, Sort, Tool } from "./support"

export type CommunityLang = "en" | "ko"

export type Surface = "desktop" | "files" | "terminal"

export type Field =
  | "mode"
  | "background"
  | "accentHue"
  | "accentSpread"
  | "vividness"
  | "texture"
  | "radius"
  | "blur"
  | "surfaceOpacity"
  | "dockBackground"
  | "dockOpacity"
  | "dockBlur"
  | "dockRadius"
  | "dockTint"
  | "dockBorder"

export type CommunityCopy = {
  title: string
  lead: string
  home: string
  languages: string
  create: string
  search: string
  sortBy: string
  sorts: Record<Sort, string>
  anyTool: string
  anyMode: string
  modes: Record<Mode, string>
  tags: string
  allTags: string
  clear: string
  count: (n: number) => string
  empty: string
  offline: string
  likes: string
  downloads: string
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
  like: string
  liked: string
  signInToLike: string
  edit: string
  remove: string
  confirmRemove: string
  editor: {
    newTitle: string
    editTitle: string
    name: string
    author: string
    description: string
    tagsField: string
    tagsHint: string
    swatch: string
    look: string
    dock: string
    fields: Record<Field, string>
    themeModes: Record<ThemeMode, string>
    backgrounds: Record<Background, string>
    dockBackgrounds: Record<DockBackground, string>
    publish: string
    save: string
    cancel: string
    signIn: string
    rateLimited: string
    failed: string
    unavailable: string
  }
}

const en: CommunityCopy = {
  title: "Community themes",
  lead: "Themes made by Eris users, previewed live on the real Eris surfaces.",
  home: "Eris home",
  languages: "Languages",
  create: "New theme",
  search: "Search themes",
  sortBy: "Sort",
  sorts: {
    popular: "Popular",
    downloads: "Most downloaded",
    likes: "Most liked",
    newest: "Newest",
    name: "Name",
  },
  anyTool: "Any tool",
  anyMode: "Any mode",
  modes: { dark: "Dark", light: "Light" },
  tags: "Tags",
  allTags: "All",
  clear: "Clear filters",
  count: n => `${n} ${n === 1 ? "theme" : "themes"}`,
  empty: "No matching themes",
  offline:
    "Showing the built-in themes. Publishing opens once the theme service is live.",
  likes: "Likes",
  downloads: "Downloads",
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
  like: "Like",
  liked: "Liked",
  signInToLike: "Sign in to like",
  edit: "Edit",
  remove: "Delete",
  confirmRemove: "Confirm delete",
  editor: {
    newTitle: "New theme",
    editTitle: "Edit theme",
    name: "Name",
    author: "Author",
    description: "Description",
    tagsField: "Tags",
    tagsHint: "Separate tags with commas.",
    swatch: "Swatch",
    look: "Look",
    dock: "Dock",
    fields: {
      mode: "Mode",
      background: "Background",
      accentHue: "Accent hue",
      accentSpread: "Color spread",
      vividness: "Vividness",
      texture: "Texture",
      radius: "Corner radius",
      blur: "Blur",
      surfaceOpacity: "Window opacity",
      dockBackground: "Dock background",
      dockOpacity: "Dock opacity",
      dockBlur: "Dock blur",
      dockRadius: "Dock radius",
      dockTint: "Dock tint",
      dockBorder: "Dock border",
    },
    themeModes: { dark: "Dark", light: "Light", system: "System" },
    backgrounds: { solid: "Standard", aura: "Modern", glass: "Glass" },
    dockBackgrounds: {
      inherit: "Theme",
      solid: "Standard",
      aura: "Modern",
      glass: "Glass",
    },
    publish: "Publish",
    save: "Save",
    cancel: "Cancel",
    signIn: "Sign in to publish",
    rateLimited: "Publishing limit reached. Try again later.",
    failed: "Publishing failed",
    unavailable: "Publishing opens once the theme service is live.",
  },
}

const ko: CommunityCopy = {
  title: "커뮤니티 테마",
  lead: "Eris 사용자가 만든 테마를 실제 Eris 화면으로 미리 봅니다.",
  home: "Eris 홈",
  languages: "언어",
  create: "새 테마",
  search: "테마 검색",
  sortBy: "정렬",
  sorts: {
    popular: "인기순",
    downloads: "다운로드순",
    likes: "좋아요순",
    newest: "최신순",
    name: "이름순",
  },
  anyTool: "모든 도구",
  anyMode: "모든 모드",
  modes: { dark: "어두운 모드", light: "밝은 모드" },
  tags: "태그",
  allTags: "전체",
  clear: "필터 초기화",
  count: n => `테마 ${n}개`,
  empty: "조건에 맞는 테마 없음",
  offline: "기본 테마를 표시합니다. 테마 서비스가 열리면 게시할 수 있습니다.",
  likes: "좋아요",
  downloads: "다운로드",
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
  like: "좋아요",
  liked: "좋아요 취소",
  signInToLike: "로그인 후 좋아요",
  edit: "편집",
  remove: "삭제",
  confirmRemove: "삭제 확인",
  editor: {
    newTitle: "새 테마",
    editTitle: "테마 편집",
    name: "이름",
    author: "제작자",
    description: "설명",
    tagsField: "태그",
    tagsHint: "태그는 쉼표로 구분하세요.",
    swatch: "대표 색상",
    look: "모양",
    dock: "독",
    fields: {
      mode: "모드",
      background: "배경",
      accentHue: "강조 색상",
      accentSpread: "색 범위",
      vividness: "채도",
      texture: "질감",
      radius: "모서리 둥글기",
      blur: "흐림",
      surfaceOpacity: "창 불투명도",
      dockBackground: "독 배경",
      dockOpacity: "독 불투명도",
      dockBlur: "독 흐림",
      dockRadius: "독 둥글기",
      dockTint: "독 색조",
      dockBorder: "독 테두리",
    },
    themeModes: {
      dark: "어두운 모드",
      light: "밝은 모드",
      system: "시스템 설정",
    },
    backgrounds: { solid: "일반", aura: "모던", glass: "글래스" },
    dockBackgrounds: {
      inherit: "테마 따름",
      solid: "일반",
      aura: "모던",
      glass: "글래스",
    },
    publish: "게시",
    save: "저장",
    cancel: "취소",
    signIn: "로그인 후 게시",
    rateLimited: "게시 한도를 넘었습니다. 잠시 후 다시 시도하세요.",
    failed: "게시 실패",
    unavailable: "테마 서비스가 열리면 게시할 수 있습니다.",
  },
}

export const copy: Record<CommunityLang, CommunityCopy> = { en, ko }
