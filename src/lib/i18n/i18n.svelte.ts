import { type Catalog, loadCatalog, sourceCatalog } from "./catalogs"
import { loadLocaleFonts } from "./fonts"
import { createFormatters } from "./format"
import {
  DEFAULT_LOCALE,
  type LocalePreference,
  type LocaleTag,
  localeInfo,
  negotiateLocale,
} from "./locales"
import { loadLocalePreference, saveLocalePreference } from "./preference"
import { createTranslator, type Message, type Translate } from "./translate"

class I18nStore {
  preference = $state<LocalePreference>("system")
  system = $state<LocaleTag>(DEFAULT_LOCALE)
  locale = $state<LocaleTag>(DEFAULT_LOCALE)
  ready = $state(false)
  dir = $derived(localeInfo(this.locale).dir)
  format = $derived(createFormatters(this.locale))
  #translate = $state.raw<Translate>(
    createTranslator(DEFAULT_LOCALE, sourceCatalog),
  )

  get wanted(): LocaleTag {
    return this.preference === "system" ? this.system : this.preference
  }

  t: Translate = (key, values) => this.#translate(key, values)

  text = (message: Message) => this.#translate(message.key, message.values)

  start() {
    this.preference = loadLocalePreference(localStorage)
    this.system = negotiateLocale(navigator.languages)

    addEventListener("languagechange", () => {
      this.system = negotiateLocale(navigator.languages)
      void this.#activate()
    })

    return this.#activate()
  }

  setPreference(preference: LocalePreference) {
    this.preference = preference
    saveLocalePreference(localStorage, preference)
    return this.#activate()
  }

  async #activate() {
    const tag = this.wanted
    const [catalog] = await Promise.all([
      loadCatalog(tag),
      loadLocaleFonts(tag),
    ])

    if (tag === this.wanted) {
      this.#apply(tag, catalog)
    }
  }

  #apply(tag: LocaleTag, catalog: Catalog) {
    this.locale = tag
    this.#translate = createTranslator(tag, catalog)
    document.documentElement.lang = tag
    document.documentElement.dir = this.dir
    this.ready = true
  }
}

export const i18n = new I18nStore()
