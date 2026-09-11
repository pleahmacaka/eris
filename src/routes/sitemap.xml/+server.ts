import { SITE_URL } from "$lib/site"
import type { RequestHandler } from "./$types"

export const prerender = true

export const GET: RequestHandler = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
`,
    { headers: { "content-type": "application/xml" } },
  )
