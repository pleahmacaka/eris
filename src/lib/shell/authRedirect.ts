import { invoke, isTauri } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { onOpenUrl } from "@tauri-apps/plugin-deep-link"
import { openUrl } from "@tauri-apps/plugin-opener"
import type { RedirectTarget } from "#lib/matrix/auth.js"
import { CALLBACK_PATH } from "#lib/routes.js"

export const ANDROID_REDIRECT = "com.arixlab.eris:/callback"
export const LOOPBACK_REGISTERED = "http://127.0.0.1/callback"

export type LoopbackPage = { title: string; body: string }

export type AuthRedirect = {
  target: RedirectTarget
  open: (url: string) => Promise<string>
  dispose: () => void
}

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

const isAndroid = () => /Android/.test(navigator.userAgent)

const deferredUrl = () => {
  let resolve: (url: string) => void = () => {}
  const promise = new Promise<string>(done => {
    resolve = done
  })

  return { promise, resolve }
}

export const loopbackTarget = (port: number): RedirectTarget => ({
  uri: `http://127.0.0.1:${port}/callback`,
  registeredUri: LOOPBACK_REGISTERED,
  applicationType: "native",
})

export const webTarget = (origin: string): RedirectTarget => {
  const uri = `${origin}${CALLBACK_PATH}`

  return {
    uri,
    registeredUri: uri,
    applicationType: LOOPBACK_HOSTS.includes(new URL(origin).hostname)
      ? "native"
      : "web",
  }
}

const webRedirect = (): AuthRedirect => ({
  target: webTarget(location.origin),
  open: url => {
    location.assign(url)

    return new Promise(() => {})
  },
  dispose: () => {},
})

const androidRedirect = async (): Promise<AuthRedirect> => {
  const callback = deferredUrl()
  const unlisten = await onOpenUrl(urls => {
    const match = urls.find(url => url.startsWith(ANDROID_REDIRECT))

    if (match) {
      callback.resolve(match)
    }
  })

  return {
    target: {
      uri: ANDROID_REDIRECT,
      registeredUri: ANDROID_REDIRECT,
      applicationType: "native",
    },
    open: async url => {
      await openUrl(url)

      return callback.promise
    },
    dispose: unlisten,
  }
}

const desktopRedirect = async (page: LoopbackPage): Promise<AuthRedirect> => {
  const callback = deferredUrl()
  const unlisten = await listen<string>("oauth-callback", event =>
    callback.resolve(event.payload),
  )
  const port = await invoke<number>("oauth_loopback_start", page).catch(
    error => {
      unlisten()
      throw error
    },
  )

  return {
    target: loopbackTarget(port),
    open: async url => {
      await openUrl(url)

      return callback.promise
    },
    dispose: unlisten,
  }
}

export const prepareAuthRedirect = (page: LoopbackPage) => {
  if (!isTauri()) {
    return Promise.resolve(webRedirect())
  }

  return isAndroid() ? androidRedirect() : desktopRedirect(page)
}

export const openExternal = (url: string) =>
  isTauri()
    ? openUrl(url)
    : Promise.resolve(void window.open(url, "_blank", "noopener"))
