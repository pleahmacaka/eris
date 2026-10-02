import { addMessages } from "svelte-i18n"
import en from "./en.json"
import ja from "./ja.json"
import ko from "./ko.json"
import zh from "./zh.json"

export const registerTerminalMessages = () => {
  addMessages("en", en)
  addMessages("ko", ko)
  addMessages("ja", ja)
  addMessages("zh", zh)
}
