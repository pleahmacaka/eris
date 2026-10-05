import { OPERATOR } from "$lib/data/nodes"
import { projects } from "$lib/data/projects"
import { locales, localizeHref } from "$lib/paraglide/runtime"
import { SITE_URL } from "$lib/site"
import type { RequestHandler } from "./$types"

export const prerender = true

const PATHS = ["/", OPERATOR.profile, ...projects.map(p => p.path)]

const alternates = (path: string) =>
  locales
    .map(
      locale =>
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${SITE_URL}${localizeHref(path, { locale })}" />`,
    )
    .join("\n")

const urls = PATHS.flatMap(path =>
  locales.map(
    locale => `  <url>
    <loc>${SITE_URL}${localizeHref(path, { locale })}</loc>
    <changefreq>weekly</changefreq>
${alternates(path)}
  </url>`,
  ),
).join("\n")

export const GET: RequestHandler = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`,
    { headers: { "content-type": "application/xml" } },
  )
