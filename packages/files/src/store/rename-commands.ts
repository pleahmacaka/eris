import type { Item } from "../items"
import { sameLocation, THIS_PC } from "../locations"
import type * as native from "../native"
import type { CommandErrors } from "./command-errors"
import { fileRenamePlan, placeRenameName, renameLanding } from "./rename-plan"
import type { Tab } from "./tab.svelte"

export type RenameContext = {
  readonly tab: Pick<Tab, "open" | "refresh" | "select" | "renaming">
  readonly filesystem: boolean
  readonly focused: Item | null
  readonly selected: Item[]
}

export type RenameServices = CommandErrors & {
  native: Pick<typeof native, "renameItem">
  network: () => native.NetworkPlace[]
  nameDrive: (drive: native.Drive, draft: string) => void
  refreshPlaces: () => Promise<void>
  displayName: (item: Item) => string
}

export const renamable = (
  context: RenameContext,
  item: Item,
  services: RenameServices,
) =>
  context.filesystem ||
  !!item.drive ||
  services.network().some(place => sameLocation(place.path, item.path))

export const rename = (context: RenameContext, services: RenameServices) => {
  const target = context.focused ?? context.selected[0]

  if (target && renamable(context, target, services)) {
    context.tab.select([target.key])
    context.tab.renaming = target.key
  }
}

export const renamePlace = async (
  context: RenameContext & { rename: () => void },
  location: string,
) => {
  await context.tab.open(THIS_PC, { select: location })
  context.rename()
}

export const commitRename = async (
  context: RenameContext,
  item: Item,
  draft: string,
  services: RenameServices,
) => {
  const tab = context.tab

  if (item.drive) {
    tab.renaming = null
    services.nameDrive(item.drive, draft)

    return tab.refresh()
  }

  const place = services
    .network()
    .find(entry => sameLocation(entry.path, item.path))

  if (place) {
    tab.renaming = null

    const name = placeRenameName(place, draft)

    if (name) {
      await services.native.renameItem(place.entry, name).catch(services.fail)
      await services.refreshPlaces()
    }

    return tab.refresh()
  }

  const plan = fileRenamePlan(item, services.displayName(item), draft)

  tab.renaming = null

  if (!plan) {
    return
  }

  await services.native.renameItem(item.key, plan.name).catch(services.fail)

  const landed = renameLanding(item.path, plan.name)

  await tab.refresh()

  // Unlike paste/archive completion, rename selects the intended path even
  // when the native rename failed. Keep that existing error behavior.
  if (landed) {
    tab.select([landed])
  }
}
