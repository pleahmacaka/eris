export type NavItem = {
  href: string
  label: string
  icon: string
}

export const primaryNav: NavItem[] = [
  { href: "/", label: "메모", icon: "lucide:notebook-pen" },
  { href: "/calendar", label: "캘린더", icon: "lucide:calendar-days" },
  { href: "/todos", label: "할 일", icon: "lucide:list-checks" },
]

export const settingsNav: NavItem = {
  href: "/settings",
  label: "설정",
  icon: "lucide:settings",
}

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href)
