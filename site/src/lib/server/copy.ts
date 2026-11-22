import {
  THEME_FAMILIES,
  THEME_FAMILY_IDS,
  themeName,
} from "#lib/brand/themeFamilies.js"
import { LOCALES, type LocaleTag } from "#lib/i18n/locales.js"
import {
  FAQ_IDS,
  FEATURE_IDS,
  type FeatureId,
  INSTALLERS,
  NETWORK_IDS,
  SCREEN_IDS,
} from "#lib/landing/content.js"
import type { Catalog } from "./i18n/catalogs"
import { createTranslator, type MessageValues } from "./i18n/translate"

const FEATURE_VALUES: Partial<Record<FeatureId, MessageValues>> = {
  themes: { count: THEME_FAMILY_IDS.length },
  languages: { count: LOCALES.length },
}

export const buildCopy = (locale: LocaleTag, catalog: Catalog) => {
  const t = createTranslator(locale, catalog)
  const ordinal = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  })

  return {
    meta: {
      title: t("meta.title"),
      description: t("meta.description"),
    },

    nav: {
      skip: t("nav.skip"),
      language: t("nav.language"),
      source: t("nav.source"),
    },

    hero: {
      eyebrow: t("hero.eyebrow"),
      tagline: t("hero.tagline"),
      download: t("hero.download"),
      source: t("hero.source"),
      maker: t("hero.maker"),
      next: t("hero.next"),
    },

    installers: INSTALLERS.map(platform => ({
      ...platform,
      action: t("download.for", { platform: platform.name }),
    })),

    web: {
      name: t("platform.web"),
      body: t("download.web.body"),
      action: t("download.web.action"),
    },

    showcase: {
      eyebrow: t("showcase.eyebrow"),
      title: t("showcase.title"),
      body: t("showcase.body"),
      tabs: t("showcase.tabs"),
      screens: SCREEN_IDS.map(id => {
        const name = t(`showcase.${id}.name`)

        return {
          id,
          name,
          body: t(`showcase.${id}.body`),
          alt: t("showcase.alt", { screen: name }),
        }
      }),
    },

    features: {
      eyebrow: t("features.eyebrow"),
      title: t("features.title"),
      items: FEATURE_IDS.map((id, index) => ({
        id,
        number: ordinal.format(index + 1),
        title: t(`features.${id}.title`),
        body: t(`features.${id}.body`, FEATURE_VALUES[id]),
      })),
    },

    themes: {
      eyebrow: t("themes.eyebrow"),
      title: t("themes.title"),
      body: t("themes.body"),
      tiles: THEME_FAMILY_IDS.map(id => {
        const name = THEME_FAMILIES[id].label

        return {
          id,
          name,
          label: t("themes.tile", { name }),
          dark: themeName(id, "dark"),
          light: themeName(id, "light"),
        }
      }),
    },

    download: {
      eyebrow: t("download.eyebrow"),
      title: t("download.title"),
      body: t("download.body"),
    },

    network: {
      eyebrow: t("matrix.eyebrow"),
      title: t("matrix.title"),
      homeserver: t("matrix.diagram.homeserver"),
      network: t("matrix.diagram.network"),
      items: NETWORK_IDS.map(id => ({
        id,
        title: t(`matrix.${id}.title`),
        body: t(`matrix.${id}.body`),
      })),
    },

    faq: {
      eyebrow: t("faq.eyebrow"),
      title: t("faq.title"),
      items: FAQ_IDS.map(id => ({
        id,
        question: t(`faq.${id}.q`),
        answer: t(`faq.${id}.a`),
      })),
    },

    cta: {
      title: t("cta.title"),
      body: t("cta.body"),
    },

    footer: {
      note: t("footer.note"),
      disclaimer: t("footer.disclaimer"),
      source: t("footer.source"),
      sections: t("footer.sections"),
    },
  }
}

export type Copy = ReturnType<typeof buildCopy>
