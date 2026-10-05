import type { Copy } from "./en"

export const ko: Copy = {
  meta: {
    title: "Eris: Windows 데스크톱 셸",
    description:
      "Eris는 Windows 작업 표시줄을 독, 런처, 패널, Eris Files, Eris Terminal로 대체합니다.",
  },

  skip: "본문으로 이동",
  languages: "언어",
  themesLink: "테마",

  account: {
    link: "로그인",
    signedIn: "계정",
    title: "Eris 계정",
    blurb: "Eris 사이트와 모든 Eris 앱에서 같은 계정을 사용합니다.",
    home: "홈으로 이동",
    finishing: "로그인 처리 중",
    failed: "로그인 실패",
    retry: "다시 로그인",
  },

  hero: {
    eyebrow: "Windows 데스크톱 셸",
    tagline: "작업 표시줄을 대체하는 독, 런처, 패널.",
    download: "Windows용 다운로드",
    source: "GitHub 저장소",
    maker: "ArixLab 프로젝트",
    next: "미리 보기",
  },

  preview: {
    title: "Eris 미리 보기",
    unavailable: "미리 보기를 불러올 수 없음",
    surface: "화면",
    surfaces: { desktop: "Eris", files: "Files", terminal: "Terminal" },
    dock: "독 스타일",
    docks: { windows: "Windows", mac: "Mac" },
  },

  cta: {
    title: "Eris 다운로드",
    body: "GitHub에서 최신 릴리스를 다운로드하세요.",
    download: "Windows용 다운로드",
  },

  footer: {
    family: "ArixLab",
    current: "현재 사이트",
    note: "Eris는 ArixLab 프로젝트입니다.",
    source: "소스 코드",
    products: {
      arixlab: "개인용 미니 인프라",
      note: "Eris와 동기화되는 노트, 할 일, 캘린더",
      eris: "Windows 데스크톱 셸",
    },
  },

  mock: {
    launcher: {
      query: "12 * 7",
      results: [
        { title: "84", hint: "계산" },
        { title: "84 복사", hint: "클립보드" },
        { title: "웹에서 12 * 7 검색", hint: "웹" },
      ],
    },
    panel: {
      month: "2026년 10월",
      weekdays: ["일", "월", "화", "수", "목", "금", "토"],
      day: "10월 2일 금요일",
      agenda: [
        { time: "종일", title: "택배 수령" },
        { time: "14:00", title: "디자인 리뷰" },
      ],
      todos: ["릴리스 노트 검토", "사진 백업", "치과 예약"],
      quickAdd: "할 일 추가",
      note: "독 아이디어",
    },
    terminal: {
      tabs: ["PowerShell", "Ubuntu"],
      prompt: "PS C:\\Projects\\eris>",
      command: "bun dev",
      output: [
        "$ vite dev",
        "Local: http://localhost:1430/",
        "ready in 412 ms",
      ],
    },
    files: {
      tabs: ["모델", "다운로드"],
      path: ["내 PC", "모델"],
      places: ["홈", "바탕 화면", "다운로드", "문서", "공유"],
      folder: "renders",
    },
    edit: {
      hint: "강조된 부분을 클릭해 변경하세요.",
      title: "독",
      rows: ["스타일", "자동 숨김"],
    },
    sync: {
      devices: ["데스크톱", "노트북"],
      collections: ["할 일", "일정", "메모", "프리셋", "프로필"],
    },
    claude: {
      ask: "스크린샷을 월별 폴더로 정리해 주세요",
      reply: "스크린샷 48개를 폴더 6개로 이동했습니다.",
      fiveHour: "5시간",
      weekly: "주간",
    },
  },
}
