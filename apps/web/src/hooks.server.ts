import type { Handle } from "@sveltejs/kit"

const KOREAN: Record<string, string> = {
  "/": "ko/",
  "/themes": "../ko/themes/",
  "/login": "../ko/login/",
}

export const handle: Handle = ({ event, resolve }) => {
  const route = event.route.id ?? ""
  const lang = route.startsWith("/ko") ? "ko" : "en"

  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace("%lang%", lang).replace("%korean%", KOREAN[route] ?? ""),
  })
}
