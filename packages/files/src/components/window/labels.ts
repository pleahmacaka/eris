import type { WindowLabels } from "@eris/ui"

export const windowLabels = (t: (key: string) => string): WindowLabels => ({
  minimize: t("explorer.window.minimize"),
  maximize: t("explorer.window.maximize"),
  restore: t("explorer.window.restore"),
  close: t("explorer.window.close"),
})
