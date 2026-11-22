import { alternates, localeUrl } from "#lib/i18n/alternates.js"
import { LOCALES } from "#lib/i18n/locales.js"
import type { RequestHandler } from "./$types"

export const prerender = true

export const GET: RequestHandler = ({ url }) => {
  const links = alternates(url.origin)
    .map(
      alternate =>
        `<xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}"/>`,
    )
    .join("")

  const urls = LOCALES.map(
    locale =>
      `<url><loc>${localeUrl(url.origin, locale.tag)}</loc>${links}</url>`,
  ).join("")

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    { headers: { "content-type": "application/xml" } },
  )
}
