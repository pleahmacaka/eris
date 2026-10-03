export const en = {
  meta: {
    title: "Eris: a desktop shell for Windows",
    description:
      "Eris replaces the Windows taskbar with a dock, a launcher, a panel, Eris Files and Eris Terminal. To the fairest.",
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
    tagline: "To the fairest.",
    download: "Download for Windows",
    source: "View on GitHub",
    maker: "By ArixLab",
    next: "Preview",
  },

  story: {
    label: "The name",
    title: "A golden apple, thrown into the feast",
    body: [
      "Eris, goddess of discord, threw a golden apple among the gods at a wedding feast. One line was cut into the gold: to the fairest. Hera, Athena and Aphrodite all reached for it.",
      "The shell takes her name and her apple. It goes to whoever chases the most beautiful desktop.",
    ],
    translation: "To the fairest",
    orbitLabel: "The planet",
    orbitTitle: "Living at the edge",
    orbitBody:
      "Eris is also a dwarf planet, one of the most distant known objects in the solar system. The shell keeps the same habit. It lives on the edges of your screen and circles your work without getting in its way.",
  },

  preview: {
    title: "Eris preview",
    unavailable: "Preview unavailable",
  },

  cta: {
    title: "The apple is yours.",
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
      matrix: "Self-hosted sensor dashboard",
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
