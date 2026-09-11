import { locales, localizeHref } from "$lib/paraglide/runtime"
import { SITE_URL } from "$lib/site"
import type { RequestHandler } from "./$types"

export const prerender = true

const alternates = locales
  .map(
    locale =>
      `    <xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_URL}${localizeHref("/", { locale })}" />`,
  )
  .join("\n")

const urls = locales
  .map(
    locale => `  <url>
    <loc>${SITE_URL}${localizeHref("/", { locale })}</loc>
    <changefreq>weekly</changefreq>
${alternates}
  </url>`,
  )
  .join("\n")

export const GET: RequestHandler = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`,
    { headers: { "content-type": "application/xml" } },
  )
