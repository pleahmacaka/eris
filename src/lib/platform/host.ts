import { isTauri } from "./runtime"

const browserName = () => {
  const agent = navigator.userAgent

  if (/Android/i.test(agent)) {
    return "Android 브라우저"
  }

  if (/iPhone|iPad/i.test(agent)) {
    return "iOS 브라우저"
  }

  if (/Mac/i.test(agent)) {
    return "Mac 브라우저"
  }

  if (/Windows/i.test(agent)) {
    return "Windows 브라우저"
  }

  return "웹 브라우저"
}

export const machineName = async () => {
  if (!isTauri()) {
    return browserName()
  }

  const { hostname } = await import("@tauri-apps/plugin-os")

  return (await hostname()) ?? ""
}
