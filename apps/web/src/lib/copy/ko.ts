import type { Copy } from "./en"

export const ko: Copy = {
  meta: {
    title: "Eris: Windows 데스크톱 셸",
    description:
      "Eris는 Windows 작업 표시줄을 독, 런처, 패널, Eris Files, Eris Terminal로 대체합니다. 가장 아름다운 이에게.",
  },

  skip: "본문으로 이동",
  languages: "언어",

  hero: {
    eyebrow: "Windows 데스크톱 셸",
    tagline: "가장 아름다운 이에게.",
    download: "Windows용 다운로드",
    source: "GitHub 저장소",
    maker: "ArixLab 프로젝트",
    next: "기능",
  },

  story: {
    label: "이름",
    title: "잔치에 던져진 황금 사과",
    body: [
      "불화의 여신 에리스는 신들의 결혼 잔치에 황금 사과 하나를 던졌습니다. 사과에는 한 줄이 새겨져 있었습니다. 가장 아름다운 이에게. 헤라와 아테나, 아프로디테가 모두 그 사과를 원했습니다.",
      "이 셸은 에리스의 이름과 사과를 물려받았습니다. 가장 아름다운 데스크톱을 찾는 사람에게 건네는 셸입니다.",
    ],
    translation: "가장 아름다운 이에게",
    orbitLabel: "왜행성",
    orbitTitle: "가장자리에서",
    orbitBody:
      "에리스는 왜행성의 이름이기도 합니다. 태양계에서 가장 멀리 있는 것으로 알려진 천체 가운데 하나입니다. 이 셸도 같은 자리를 지킵니다. 화면 가장자리에 머물며, 작업을 가리지 않고 그 주위를 공전합니다.",
  },

  features: {
    label: "기능",
    title: "작업 주위를 공전합니다.",
    new: "신규",
    items: {
      dock: {
        title: "독",
        lead: "Windows 작업 표시줄을 트레이까지 대체합니다.",
        points: [
          "Windows 또는 mac 스타일",
          "실시간 창 미리 보기",
          "모든 트레이 기능",
          "독 전용 모양",
          "자동 숨김",
        ],
      },
      launcher: {
        title: "런처",
        lead: "Win 키를 누르고 입력하세요.",
        points: ["앱", "창", "명령", "계산", "타이머", "클립보드", "웹"],
      },
      panel: {
        title: "패널",
        lead: "시계를 클릭하면 작은 캘린더가 열리고, 부드럽게 전체 캘린더로 커집니다.",
        points: [
          "그날 일정과 할 일, 메모를 한눈에 보는 작은 캘린더",
          "할 일, 개인, 업무 같은 일정 태그와 직접 만든 태그",
          "화면 공유 중 숨김 태그",
          "상위 일정, 하위 일정, 시작 시간만 있는 일정",
          "반복 일정을 이 일정만, 이후 일정, 모든 일정으로 수정",
          "주말과 공휴일을 피해 옮기는 반복 일정과 알림",
        ],
      },
      files: {
        title: "Eris Files",
        lead: "파일 탐색기를 그대로 대체하는, 더 빠르고 더 아름다운 파일 관리자입니다.",
        points: [
          "탭",
          "탐색기 단축키와 실행 인수 호환",
          "네이티브 셸 메뉴와 파일 작업",
          "미리 보기",
          "다른 앱으로도 끌어 놓는 드래그 앤 드롭",
          "드래그로 여러 항목 선택",
          "명령, %변수%, shell: 경로를 바로 실행하는 주소 표시줄",
          "다운로드 폴더 날짜별 묶기 등 폴더별 보기 규칙",
          "네트워크 드라이브와 네트워크 위치",
          "파형 오디오 플레이어와 Whisper 전사",
          "Ctrl+`로 여는 내장 터미널 패널",
          "링크와 QR 코드로 주고받는 P2P 공유",
          "보낸 공유, 받은 공유, 동기화 폴더를 모아 보는 공유 위치",
          "기본 1일 만료 링크, 1시간, 7일, 30일, 만료 없음, 날짜 지정 선택",
          "공유마다 내려받은 장치와 시간 확인",
          "상대 장치가 수락하고 폴더를 직접 고르는 양방향 폴더 동기화",
          "충돌은 사본으로 보존, 삭제는 휴지통으로, 시스템 폴더 차단, AppData 경고",
          "모서리 조작과 조명을 갖춘 OBJ, MTL 3D 뷰어",
          "Windows 기본 앱 등록, 폴더 열기와 Win+E 대체",
          "Eris와 연동되는 스타일",
        ],
      },
      terminal: {
        title: "Eris Terminal",
        lead: "Eris 안에서 실행되는 빠른 터미널입니다.",
        points: [
          "ConPTY 셸: PowerShell, cmd, WSL, Git Bash",
          "탭과 새 창",
          "기본 글꼴 JetBrains Mono Nerd Font",
          "Windows Terminal과 같은 복사와 붙여넣기",
          "Eris와 연동되는 스타일",
        ],
      },
      themes: {
        title: "테마",
        lead: "프리셋에서 시작해 어느 부분이든 변경하세요.",
        points: [
          "모든 창에 같은 카드 디자인",
          "Arix, 기본 프리셋인 깊은 검정",
          "Aurora, 짙은 파랑 위를 떠다니는 오브",
          "Glass, 카드 위에 얹는 실제 Windows 아크릴",
        ],
      },
      edit: {
        title: "편집 모드",
        lead: "화면을 어둡게 하고, 무엇이든 클릭해 그 자리에서 변경합니다.",
        points: [
          "강조된 부분을 클릭해 변경합니다.",
          "독 위젯 순서와 여백 너비를 그 자리에서 조정합니다.",
        ],
      },
      sync: {
        title: "동기화",
        lead: "장치를 페어링하고 장치끼리 직접 동기화합니다.",
        points: ["P2P 방식", "할 일, 일정, 메모", "프리셋과 프로필"],
      },
      claude: {
        title: "Claude",
        lead: "파일을 대상으로 Claude Code를 실행하는 버블입니다.",
        points: [
          "여러 세션",
          "실시간 모델 전환",
          "메시지 대기열",
          "독의 Claude 사용량 위젯",
        ],
      },
    },
  },

  specs: {
    title: "가벼운 셸",
    items: [
      { value: "< 400 MB", label: "유휴 상태 메모리" },
      { value: "≈ 0", label: "GPU 사용량" },
      { value: "0.12초", label: "System32 아이콘 1,000개, 이전 1.28초" },
      { value: "4", label: "지원 언어" },
    ],
    note: "Files와 Terminal은 Eris 프로세스 안에서 실행되고, 백그라운드 작업은 켠 기능에서만 실행됩니다.",
  },

  cta: {
    title: "이제 사과를 받을 차례입니다.",
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
      matrix: "셀프 호스팅 센서 대시보드",
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
