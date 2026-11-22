import type { Component } from "svelte"
import type { ScreenId } from "#lib/landing/content.js"
import type { MockCopy } from "#lib/server/mock.js"
import ChatScreen from "./screens/ChatScreen.svelte"
import FriendsScreen from "./screens/FriendsScreen.svelte"
import LoginScreen from "./screens/LoginScreen.svelte"
import RolesScreen from "./screens/RolesScreen.svelte"
import SwitcherScreen from "./screens/SwitcherScreen.svelte"
import VoiceScreen from "./screens/VoiceScreen.svelte"

export const SCREEN_VIEWS: Record<ScreenId, Component<{ t: MockCopy }>> = {
  chat: ChatScreen,
  voice: VoiceScreen,
  friends: FriendsScreen,
  switcher: SwitcherScreen,
  roles: RolesScreen,
  login: LoginScreen,
}
