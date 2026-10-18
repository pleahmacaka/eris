export type MenuAction = {
  id?: string
  label: string
  icon?: string
  action: () => unknown
  disabled?: boolean
  hint?: string
}

export type MenuGroup = {
  label: string
  icon?: string
  items: MenuItem[]
}

export type MenuItem = MenuAction | MenuGroup | "separator"

export const isAction = (item: MenuItem): item is MenuAction =>
  typeof item === "object" && "action" in item

export const isGroup = (item: MenuItem): item is MenuGroup =>
  typeof item === "object" && "items" in item

export const flattenGroups = (items: MenuItem[]): MenuItem[] =>
  items.flatMap(item => (isGroup(item) ? flattenGroups(item.items) : [item]))
