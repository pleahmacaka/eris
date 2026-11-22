import { defineParams } from "@sveltejs/kit/params"
import { isLocaleTag } from "./lib/i18n/locales.ts"

export const params = defineParams({
  locale: param => (isLocaleTag(param) ? param : undefined),
})
