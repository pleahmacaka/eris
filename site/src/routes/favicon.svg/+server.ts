import { logoSvg } from "#lib/brand/logo.js"
import { THEME_FAMILIES } from "#lib/brand/themeFamilies.js"

export const prerender = true

export const GET = () =>
  new Response(
    logoSvg(token => THEME_FAMILIES.eris.dark[token]),
    { headers: { "content-type": "image/svg+xml" } },
  )
