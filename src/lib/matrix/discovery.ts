import { AutoDiscovery, AutoDiscoveryAction } from "matrix-js-sdk"
import { normalizeHomeserver } from "./session"

export const discoverHomeserver = async (domain: string) => {
  const config = await AutoDiscovery.findClientConfig(domain)
  const homeserver = config["m.homeserver"]

  return homeserver.state === AutoDiscoveryAction.SUCCESS && homeserver.base_url
    ? normalizeHomeserver(homeserver.base_url)
    : null
}
