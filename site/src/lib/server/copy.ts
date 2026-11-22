import {
  COLOR_SCHEMES,
  DEFAULT_THEME_FAMILY,
  THEME_FAMILIES,
  THEME_FAMILY_IDS,
  themeName,
} from "#lib/brand/themeFamilies.js"
import type { LocaleTag } from "#lib/i18n/locales.js"
import { INSTALLERS, NETWORK_IDS, SCREEN_IDS } from "#lib/landing/content.js"
import type { Catalog } from "./i18n/catalogs"
import { createTranslator } from "./i18n/translate"
import { buildMockCopy } from "./mock"

export const buildCopy = (locale: LocaleTag, catalog: Catalog) => {
  const t = createTranslator(locale, catalog)
  const mock = buildMockCopy(locale, t)

  return {
    meta: {
      title: t("meta.title"),
      description: t("meta.description"),
    },

    nav: {
      skip: t("nav.skip"),
      language: t("nav.language"),
      source: t("nav.source"),
      preview: t("nav.preview"),
      themes: t("nav.themes"),
      download: t("nav.download"),
      matrix: t("nav.matrix"),
    },

    hero: {
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
      title: t("showcase.title"),
      body: t("showcase.body"),
      tabs: t("showcase.tabs"),
      expand: t("showcase.expand"),
      close: t("showcase.close"),
      demo: t("showcase.demo"),
      screens: SCREEN_IDS.map(id => {
        const name = t(`showcase.${id}.name`)

        return {
          id,
          name,
          body: t(`showcase.${id}.body`),
          alt: t("showcase.alt", { screen: name }),
        }
      }),
      mock,
    },

    themes: {
      title: t("themes.title"),
      body: t("themes.body"),
      fallback: themeName(DEFAULT_THEME_FAMILY, "dark"),
      preview: {
        region: t("themes.preview.region"),
        mode: t("themes.preview.mode"),
        reset: t("themes.preview.reset"),
        schemes: COLOR_SCHEMES.map(id => ({
          id,
          label: t(`themes.preview.${id}`),
        })),
      },
      miniature: {
        channel: mock.channels.general,
        unread: new Intl.NumberFormat(locale).format(3),
        rows: mock.threads.general.slice(0, 2).map(line => ({
          name: line.name,
          text: line.parts.map(part => part.text).join(""),
        })),
        send: t("mock.composer.send"),
      },
      tiles: THEME_FAMILY_IDS.map(id => {
        const name = THEME_FAMILIES[id].label

        return {
          id,
          name,
          label: t("themes.tile", { name }),
          status: t("themes.preview.active", { name }),
          dark: themeName(id, "dark"),
          light: themeName(id, "light"),
        }
      }),
    },

    demo: {
      meta: {
        title: t("demo.meta.title"),
        description: t("demo.meta.description"),
      },
      title: t("demo.title"),
      note: t("demo.note"),
      home: t("demo.home"),
    },

    download: {
      title: t("download.title"),
      body: t("download.body"),
    },

    network: {
      title: t("matrix.title"),
      homeserver: t("matrix.diagram.homeserver"),
      network: t("matrix.diagram.network"),
      items: NETWORK_IDS.map(id => ({
        id,
        title: t(`matrix.${id}.title`),
        body: t(`matrix.${id}.body`),
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
