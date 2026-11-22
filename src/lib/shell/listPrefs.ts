export const DM_PREVIEW_KEY = "eris.dmPreview"

type PrefStorage = Pick<Storage, "getItem" | "setItem">

export const loadDmPreview = (storage: PrefStorage) =>
  storage.getItem(DM_PREVIEW_KEY) === "on"

export const saveDmPreview = (storage: PrefStorage, show: boolean) => {
  storage.setItem(DM_PREVIEW_KEY, show ? "on" : "off")
}
