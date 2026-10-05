export const en = {
  meta: {
    title: "Eris: a desktop shell for Windows",
    description:
      "Eris replaces the Windows taskbar with a dock, a launcher, a panel, Eris Files and Eris Terminal.",
  },

  skip: "Skip to content",
  languages: "Language",
  themesLink: "Themes",

  account: {
    link: "Sign in",
    signedIn: "Account",
    title: "Eris account",
    blurb: "One account for the Eris site and every Eris app.",
    home: "Back to home",
    finishing: "Finishing sign-in",
    failed: "Sign-in failed",
    retry: "Try again",
  },

  hero: {
    eyebrow: "A desktop shell for Windows",
    tagline: "A dock, launcher and panel that replace the taskbar.",
    download: "Download for Windows",
    source: "View on GitHub",
    maker: "By ArixLab",
    next: "Preview",
  },

  preview: {
    title: "Eris preview",
    unavailable: "Preview unavailable",
    surface: "Screen",
    surfaces: { desktop: "Eris", files: "Files", terminal: "Terminal" },
    dock: "Dock style",
    docks: { windows: "Windows", mac: "Mac" },
  },

  cta: {
    title: "Get Eris",
    body: "Download the latest release from GitHub.",
    download: "Download for Windows",
  },

  footer: {
    family: "ArixLab",
    current: "This site",
    note: "Eris is an ArixLab project.",
    source: "Source code",
    products: {
      arixlab: "Personal mini infrastructure",
      note: "Notes, todos and calendar that sync with Eris",
      eris: "Desktop shell for Windows",
    },
  },

  mock: {
    launcher: {
      query: "12 * 7",
      results: [
        { title: "84", hint: "Math" },
        { title: "Copy 84", hint: "Clipboard" },
        { title: "Search the web for 12 * 7", hint: "Web" },
      ],
    },
    panel: {
      month: "October 2026",
      weekdays: ["S", "M", "T", "W", "T", "F", "S"],
      day: "Friday, October 2",
      agenda: [
        { time: "All day", title: "Parcel pickup" },
        { time: "14:00", title: "Design review" },
      ],
      todos: ["Review release notes", "Back up photos", "Book the dentist"],
      quickAdd: "Add a todo",
      note: "Dock ideas",
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
      tabs: ["Models", "Downloads"],
      path: ["This PC", "Models"],
      places: ["Home", "Desktop", "Downloads", "Documents", "Shared"],
      folder: "renders",
    },
    edit: {
      hint: "Click a highlighted part to change it.",
      title: "Dock",
      rows: ["Style", "Auto-hide"],
    },
    sync: {
      devices: ["Desktop", "Laptop"],
      collections: ["Todos", "Events", "Notes", "Presets", "Profile"],
    },
    claude: {
      ask: "Sort my screenshots into folders by month",
      reply: "Moved 48 screenshots into 6 folders.",
      fiveHour: "5-hour",
      weekly: "Weekly",
    },
  },
}

export type Copy = typeof en
