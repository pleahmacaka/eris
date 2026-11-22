import chat from "../assets/screens/chat.png?enhanced"
import friends from "../assets/screens/friends.png?enhanced"
import login from "../assets/screens/login.png?enhanced"
import roles from "../assets/screens/roles.png?enhanced"
import switcher from "../assets/screens/switcher.png?enhanced"
import voice from "../assets/screens/voice.png?enhanced"
import type { ScreenId } from "./content"

export const SCREEN_IMAGES = {
  chat,
  voice,
  friends,
  switcher,
  roles,
  login,
} satisfies Record<ScreenId, unknown>
