import type { Item } from "../items"
import { isVirtual, THIS_PC } from "../locations"
import type * as native from "../native"
import type { CommandErrors } from "./command-errors"
import type { Tab } from "./tab.svelte"

export type ShellContext = {
  readonly tab: Pick<Tab, "location" | "refresh" | "open" | "renaming">
  readonly selected: Item[]
  readonly filesystem: boolean
  readonly inBin: boolean
  rename: () => void
}

export type ShellServices = CommandErrors & {
  native: Pick<
    typeof native,
    | "newWindow"
    | "deleteItems"
    | "newFolder"
    | "showProperties"
    | "nativeMenu"
    | "invokeVerb"
    | "emptyRecycleBin"
  >
  confirmAll: (paths: string[], from: string) => Promise<boolean>
  refreshPlaces: () => Promise<void>
  pinnedKey: (location: string) => string | undefined
  newFolderName: () => string
  openProperties: (paths: string[]) => void
}

export const openWindow = (location: string, services: ShellServices) => {
  services.native.newWindow(location).catch(services.fail)
}

export const remove = async (
  context: ShellContext,
  permanent: boolean,
  services: ShellServices,
) => {
  const keys = context.selected.map(item => item.key)

  if (keys.length) {
    await services.native
      .deleteItems(keys, permanent || context.inBin)
      .catch(services.fail)
    await context.tab.refresh()
  }
}

export const newFolder = async (
  context: ShellContext,
  services: ShellServices,
) => {
  if (!context.filesystem) {
    return
  }

  const tab = context.tab
  const created = await services.native
    .newFolder(tab.location, services.newFolderName())
    .catch(services.failed)

  if (created) {
    await tab.open(tab.location, { record: false, select: created })
    tab.renaming = created
  }
}

export const properties = (
  context: ShellContext,
  keys: string[],
  services: ShellServices,
) => {
  const paths = keys.length ? keys : [context.tab.location]
  const own =
    context.filesystem &&
    !context.inBin &&
    paths.every(path => !isVirtual(path) && !path.startsWith("pidl:"))

  if (own) {
    services.openProperties(paths)
  } else {
    services.native.showProperties(paths).catch(services.fail)
  }
}

export const more = async (
  context: ShellContext,
  keys: string[],
  extended: boolean,
  services: ShellServices,
) => {
  const paths = context.selected.map(item => item.path)

  if (!(await services.confirmAll(paths, context.tab.location))) {
    return
  }

  const verb = await services.native
    .nativeMenu(keys, keys.length ? null : context.tab.location, extended)
    .catch(services.failed)

  if (verb === "rename") {
    return context.rename()
  }

  if (verb !== null) {
    await Promise.all([context.tab.refresh(), services.refreshPlaces()])
  }
}

export const pin = async (
  location: string,
  pinned: boolean,
  services: ShellServices,
) => {
  // The folder offers pintohome; unpinning lives on its Home entry.
  const target = (pinned && services.pinnedKey(location)) || location

  await services.native
    .invokeVerb([target], pinned ? "unpinfromhome" : "pintohome")
    .catch(services.fail)
  await services.refreshPlaces()
}

export const restore = async (
  context: ShellContext,
  services: ShellServices,
) => {
  const keys = context.selected.map(item => item.key)

  if (keys.length) {
    await services.native.invokeVerb(keys, "undelete").catch(services.fail)
    await context.tab.refresh()
  }
}

export const emptyBin = async (
  context: ShellContext,
  services: ShellServices,
) => {
  await services.native.emptyRecycleBin().catch(services.fail)

  if (context.inBin) {
    await context.tab.refresh()
  }
}

export const changePlaces = async (
  context: ShellContext,
  run: () => Promise<unknown>,
  services: ShellServices,
) => {
  await run().catch(services.fail)

  if (context.tab.location === THIS_PC) {
    await context.tab.refresh()
  } else {
    await services.refreshPlaces()
  }
}
