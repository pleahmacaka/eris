import type { RequestHandler } from "./$types"

export const prerender = true

export const GET: RequestHandler = ({ url }) =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${url.origin}/sitemap.xml`,
      "",
    ].join("\n"),
    { headers: { "content-type": "text/plain" } },
  )
