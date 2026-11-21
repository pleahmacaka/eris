export const TITLE_BAR_KEY = "eris.titleBar"

type SettingStorage = Pick<Storage, "getItem" | "setItem">

export const loadTitleBarSetting = (storage: SettingStorage) =>
  storage.getItem(TITLE_BAR_KEY) !== "off"

export const saveTitleBarSetting = (storage: SettingStorage, custom: boolean) =>
  storage.setItem(TITLE_BAR_KEY, custom ? "on" : "off")
