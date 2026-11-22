import { goto } from "$app/navigation"
import { page } from "$app/state"

export const visit = (path: string) => {
  if (page.url.pathname !== path) {
    void goto(path)
  }
}
