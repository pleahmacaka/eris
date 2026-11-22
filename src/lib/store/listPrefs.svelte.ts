import { loadDmPreview, saveDmPreview } from "#lib/shell/listPrefs.js"

class ListPrefsStore {
  dmPreview = $state(false)

  start() {
    this.dmPreview = loadDmPreview(localStorage)
  }

  setDmPreview(show: boolean) {
    this.dmPreview = show
    saveDmPreview(localStorage, show)
  }
}

export const listPrefsStore = new ListPrefsStore()
