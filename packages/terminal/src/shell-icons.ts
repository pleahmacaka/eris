const SERIAL = "serial:"

type ShellIcon = { icon: string; color?: string }

const DISTROS: [string, ShellIcon][] = [
  ["ubuntu", { icon: "logos:ubuntu" }],
  ["debian", { icon: "logos:debian" }],
  ["arch", { icon: "logos:archlinux" }],
  ["fedora", { icon: "logos:fedora" }],
  ["centos", { icon: "logos:centos-icon" }],
  ["rhel", { icon: "logos:redhat-icon" }],
  ["redhat", { icon: "logos:redhat-icon" }],
  ["oracle", { icon: "logos:oracle" }],
  ["manjaro", { icon: "logos:manjaro" }],
  ["mint", { icon: "logos:linux-mint" }],
  ["rocky", { icon: "logos:rocky-linux-icon" }],
  ["void", { icon: "logos:void" }],
  ["nixos", { icon: "material-icon-theme:nix" }],
  ["podman", { icon: "simple-icons:podman", color: "#892ca0" }],
  ["docker", { icon: "logos:docker-icon" }],
]

const SHELLS: Record<string, ShellIcon> = {
  pwsh: { icon: "material-icon-theme:powershell" },
  powershell: { icon: "material-icon-theme:powershell" },
  cmd: { icon: "material-icon-theme:console" },
  "git-bash": { icon: "logos:git-icon" },
  bash: { icon: "logos:bash-icon" },
}

const TERMINAL: ShellIcon = { icon: "lucide:square-terminal" }

export const serialTarget = (id: string) =>
  id.startsWith(SERIAL) ? id.slice(SERIAL.length).split("@")[0] : null

export const shellIcon = (id: string): ShellIcon => {
  if (id.startsWith(SERIAL)) {
    return { icon: "lucide:usb" }
  }

  if (id.startsWith("wsl:")) {
    const distro = id.slice(4).toLowerCase()

    return (
      DISTROS.find(([name]) => distro.includes(name))?.[1] ?? {
        icon: "logos:linux-tux",
      }
    )
  }

  return SHELLS[id] ?? TERMINAL
}
