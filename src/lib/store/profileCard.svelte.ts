export type ProfileCardTarget = { userId: string; anchor: DOMRect }

class ProfileCardStore {
  target = $state.raw<ProfileCardTarget | null>(null)

  open(userId: string, anchor: Element) {
    this.target = { userId, anchor: anchor.getBoundingClientRect() }
  }

  close() {
    this.target = null
  }
}

export const profileCardStore = new ProfileCardStore()
