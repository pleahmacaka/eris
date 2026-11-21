export const HOME_SEGMENT = "@me"

export const LOGIN_PATH = "/login"

export const SETTINGS_PATH = "/settings"

export const HOME_PATH = `/channels/${HOME_SEGMENT}`

export const SHELL_SCOPE = "/channels/**"

export const HOME_VIEWS = ["friends", "home"] as const

export type HomeView = (typeof HOME_VIEWS)[number]

export const homeViewPath = (view: HomeView) => `${HOME_PATH}/${view}`

const isHomeView = (segment: string | undefined): segment is HomeView =>
  HOME_VIEWS.some(view => view === segment)

export const parseHomeView = (pathname: string): HomeView | null => {
  const [head, space, view, ...rest] = pathname
    .split("/")
    .filter(segment => segment !== "")

  return head === "channels" &&
    space === HOME_SEGMENT &&
    rest.length === 0 &&
    isHomeView(view)
    ? view
    : null
}

export type ChannelsRoute = { spaceId: string | null; roomId: string | null }

export const channelsPath = ({ spaceId, roomId }: ChannelsRoute) => {
  const base = `/channels/${spaceId ? encodeURIComponent(spaceId) : HOME_SEGMENT}`

  return roomId ? `${base}/${encodeURIComponent(roomId)}` : base
}

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export const parseChannelsPath = (pathname: string): ChannelsRoute | null => {
  const segments = pathname.split("/").filter(segment => segment !== "")
  const [head, space, room] = segments

  if (head !== "channels" || space === undefined || segments.length > 3) {
    return null
  }

  const home = space === HOME_SEGMENT

  return {
    spaceId: home ? null : decode(space),
    roomId:
      room === undefined || (home && isHomeView(room)) ? null : decode(room),
  }
}

export const isChatPath = (pathname: string) =>
  parseChannelsPath(pathname)?.roomId != null
