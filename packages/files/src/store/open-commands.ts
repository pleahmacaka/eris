import type { Item } from "../items"
import type * as native from "../native"
import type { CommandErrors } from "./command-errors"
import { openPlan } from "./open-plan"

export type OpenContext = {
  readonly tab: { location: string }
  readonly selected: Item[]
  go: (location: string) => void
  open: (item: Item) => Promise<unknown>
}

export type OpenServices = CommandErrors & {
  native: Pick<
    typeof native,
    "extractEntry" | "isMujoco" | "openViewer" | "openItem"
  >
  confirmPrivate: (path: string, from: string) => Promise<boolean>
  isArchive: (name: string) => boolean
  packedEntry: (item: Item) => string
}

export const openItem = async (
  context: OpenContext,
  item: Item,
  services: OpenServices,
): Promise<unknown> => {
  if (!(await services.confirmPrivate(item.path, context.tab.location))) {
    return
  }

  const plan = openPlan(item, services.isArchive(item.name))

  if (plan === "navigate") {
    return context.go(item.path)
  }

  if (plan === "extract" && item.packed) {
    const extracted = await services.native
      .extractEntry(item.packed, services.packedEntry(item))
      .catch(services.failed)

    return extracted
      ? context.open({
          ...item,
          key: extracted,
          path: extracted,
          packed: undefined,
        })
      : undefined
  }

  const mujoco =
    plan === "probeXml" &&
    (await services.native.isMujoco(item.path).catch(() => false))

  if (plan === "viewer" || mujoco) {
    return services.native.openViewer(item.path).catch(services.fail)
  }

  const folder = await services.native.openItem(item.key).catch(services.failed)

  // Navigation deliberately uses the current tab, including after a privacy
  // prompt, extraction or shell dispatch. This is not a captured-tab command.
  if (folder) {
    context.go(folder)
  }
}

export const openSelection = (context: OpenContext) => {
  const [first, ...rest] = context.selected

  if (!first) {
    return
  }

  if (!rest.length) {
    return context.open(first)
  }

  for (const item of context.selected.filter(item => !item.dir)) {
    context.open(item)
  }

  const folder = context.selected.find(item => item.dir)

  if (folder) {
    context.go(folder.path)
  }
}
