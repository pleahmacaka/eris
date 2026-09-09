export type MenuAction = {
  label: string
  icon?: string
  action: () => unknown
  disabled?: boolean
  hint?: string
}

export type MenuItem = MenuAction | "separator"

export const isAction = (item: MenuItem): item is MenuAction =>
  item !== "separator"
