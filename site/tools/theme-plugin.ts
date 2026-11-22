import type { PluginCreator } from "tailwindcss/plugin"
import { themeRules } from "../src/lib/brand/themeFamilies.ts"

const themes: PluginCreator = ({ addBase }) => {
  addBase(themeRules())
}

export default themes
