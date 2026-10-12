import { tr } from "@eris/i18n"
import { toast } from "@eris/ui"
import { isVirtual, sameLocation } from "../locations"
import { gitClone } from "../native"
import type { Remote } from "../remote"
import { fail } from "./command-errors"
import type { Tab } from "./tab.svelte"
import { trustRepo } from "./trust"

export const cloneInto = async (tab: Tab, remote: Remote) => {
  const parent = tab.location

  if (isVirtual(parent)) {
    toast(tr("explorer.git.needFolder"), "error")

    return
  }

  toast(tr("explorer.git.cloning", { name: remote.name }))

  try {
    const path = await gitClone(parent, remote.url, remote.name, remote.flags)

    trustRepo(path)
    toast(tr("explorer.git.cloned", { name: remote.name }), "success")

    if (sameLocation(tab.location, parent)) {
      await tab.open(parent, { select: path })
    }
  } catch (reason) {
    fail(reason)
  }
}
