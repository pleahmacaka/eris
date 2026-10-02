export const en = {
  meta: {
    title: "Eris: a desktop shell for Windows",
    description:
      "Eris replaces the Windows taskbar with a dock, a launcher, a panel, Eris Files and Eris Terminal. To the fairest.",
  },

  skip: "Skip to content",
  languages: "Language",

  hero: {
    eyebrow: "A desktop shell for Windows",
    tagline: "To the fairest.",
    download: "Download for Windows",
    source: "View on GitHub",
    maker: "By ArixLab",
    next: "Features",
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

  features: {
    label: "Features",
    title: "It orbits your work.",
    new: "New",
    items: {
      dock: {
        title: "Dock",
        lead: "Replaces the Windows taskbar, tray included.",
        points: [
          "Windows or mac style",
          "Live window previews",
          "Every tray feature",
          "Its own look",
          "Auto-hide",
        ],
      },
      launcher: {
        title: "Launcher",
        lead: "Press Win and type.",
        points: [
          "Apps",
          "Windows",
          "Commands",
          "Math",
          "Timers",
          "Clipboard",
          "Web",
        ],
      },
      panel: {
        title: "Panel",
        lead: "Click the clock. A small calendar opens and grows smoothly into the full one.",
        points: [
          "Compact calendar with the day's agenda, todos and notes",
          "Event tags like Todo, Personal and Work, plus your own",
          "Chosen tags stay hidden while your screen is shared",
          "Parent and sub events, and events with only a start time",
          "Edit a repeat for this one, this and following, or all",
          "Repeats move off weekends and holidays, reminders follow",
        ],
      },
      files: {
        title: "Eris Files",
        lead: "A faster, prettier drop-in replacement for File Explorer.",
        points: [
          "Tabs",
          "Explorer shortcuts and arguments",
          "Native shell menus and file operations",
          "Previews",
          "Drag and drop, also into other apps",
          "Rubber-band selection",
          "Address bar that runs commands, %variables% and shell: paths",
          "Folder view rules, with Downloads grouped by date",
          "Network drives and locations",
          "Audio player with waveform and Whisper transcription",
          "Built-in terminal panel on Ctrl+`",
          "Peer-to-peer sharing with links and QR codes",
          "A Shared place listing what you share, what you received and synced folders",
          "Links expire after 1 day by default, or 1 hour, 7 days, 30 days, never or a date you pick",
          "See which device downloaded each share, and when",
          "Opt-in two-way folder sync; the paired device accepts and picks its own folder",
          "Conflicts kept as copies, deletions sent to the Recycle Bin, system folders blocked, AppData warned",
          "OBJ and MTL 3D viewer with corner controls and lighting",
          "Registers as a Windows default app, and opens folders and Win+E",
          "Styled in sync with Eris",
        ],
      },
      terminal: {
        title: "Eris Terminal",
        lead: "A fast terminal that runs inside Eris.",
        points: [
          "ConPTY shells: PowerShell, cmd, WSL and Git Bash",
          "Tabs and new windows",
          "JetBrains Mono Nerd Font by default",
          "Copy and paste like Windows Terminal",
          "Follows the Eris style",
        ],
      },
      themes: {
        title: "Themes",
        lead: "Start from a preset, then change any part of it.",
        points: [
          "One card design across every window",
          "Arix, the near-black default",
          "Aurora, drifting orbs on deep blue",
          "Glass, layered on the cards with real Windows Acrylic",
        ],
      },
      edit: {
        title: "Edit mode",
        lead: "Dim the screen, click anything, change it there.",
        points: [
          "Click a highlighted part to change it",
          "Arrange dock widgets and spacing in place",
        ],
      },
      sync: {
        title: "Sync",
        lead: "Pair your devices and sync directly between them.",
        points: [
          "Peer to peer",
          "Todos, events and notes",
          "Presets and profile",
        ],
      },
      claude: {
        title: "Claude",
        lead: "A bubble that runs Claude Code on your files.",
        points: [
          "Multiple sessions",
          "Live model switch",
          "Message queue",
          "Claude usage widget on the dock",
        ],
      },
    },
  },

  specs: {
    title: "Light on your machine",
    items: [
      { value: "< 400 MB", label: "Memory at idle" },
      { value: "≈ 0", label: "GPU load" },
      { value: "0.12 s", label: "1,000 icons in System32, down from 1.28 s" },
      { value: "4", label: "Languages" },
    ],
    note: "Files and Terminal run inside Eris's own process, and background work only runs for the features you turn on.",
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
