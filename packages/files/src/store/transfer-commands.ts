import type { Item } from "../items"
import type * as native from "../native"
import type { CommandErrors } from "./command-errors"
import type { Tab } from "./tab.svelte"
import { transferPlan } from "./transfer-plan"

export type TransferContext = {
  readonly tab: Pick<Tab, "location" | "refresh" | "items" | "select">
  readonly filesystem: boolean
  readonly selected: Item[]
}

export type TransferServices = CommandErrors & {
  native: Pick<
    typeof native,
    | "setClipboard"
    | "pasteItems"
    | "bandizipJob"
    | "copyItems"
    | "moveItems"
    | "startDrag"
  >
  writeText: (text: string) => Promise<void>
  confirmAll: (paths: string[], from: string) => Promise<boolean>
  archiveNotice: (done: boolean) => void
}

// Both paste and archive completion refresh the captured tab, then select only
// exact keys in its refreshed listing. No landed keys means keep its selection.
export const refreshLanded = async (
  tab: Pick<Tab, "refresh" | "items" | "select">,
  landed: string[],
) => {
  await tab.refresh()

  const keys = new Set(tab.items.map(item => item.key))
  const present = landed.filter(path => keys.has(path))

  if (present.length) {
    tab.select(present)
  }
}

export const clipSelection = async (
  context: TransferContext,
  cut: boolean,
  services: TransferServices,
) => {
  const paths = context.selected.map(item => item.path)

  if (paths.length) {
    await services.native.setClipboard(paths, cut).catch(services.fail)
  }
}

export const copySelectionPath = (
  context: TransferContext,
  services: TransferServices,
) => {
  const text = context.selected.map(item => `"${item.path}"`).join("\r\n")

  if (text) {
    services.writeText(text).catch(services.fail)
  }
}

export const paste = async (
  context: TransferContext,
  services: TransferServices,
) => {
  if (!context.filesystem) {
    return
  }

  const tab = context.tab
  const landed =
    (await services.native.pasteItems(tab.location).catch(services.failed)) ??
    []

  // Paste refreshes even on error/cancellation; archive jobs do not.
  await refreshLanded(tab, landed)
}

export const bandizip = async (
  context: TransferContext,
  job: native.BandizipJob,
  paths: string[],
  services: TransferServices,
) => {
  const tab = context.tab

  services.archiveNotice(false)

  const made = await services.native
    .bandizipJob(job, paths)
    .catch(services.failed)

  if (!made) {
    return
  }

  services.archiveNotice(true)
  await refreshLanded(tab, made)
}

export const drop = async (
  context: TransferContext,
  paths: string[],
  target: string | null,
  services: TransferServices,
) => {
  const plan = transferPlan(
    paths,
    context.tab.location,
    context.filesystem,
    target,
  )

  if (!plan) {
    return
  }

  await (plan.move ? services.native.moveItems : services.native.copyItems)(
    plan.changed,
    plan.into,
  ).catch(services.fail)
  await context.tab.refresh()
}

export const drag = async (
  context: TransferContext,
  services: TransferServices,
) => {
  const keys = context.selected.map(item => item.key)
  const paths = context.selected.map(item => item.path)

  if (keys.length && (await services.confirmAll(paths, context.tab.location))) {
    await services.native.startDrag(keys).catch(services.fail)
    await context.tab.refresh()
  }
}
