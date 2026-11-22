import {
  type MatrixClient,
  type MatrixEvent,
  RoomStateEvent,
} from "matrix-js-sdk"
import { type RoomAdmin, roomAdmin } from "#lib/matrix/roomActions.js"

class RoomAdminStore {
  view = $state.raw<RoomAdmin | null>(null)
  partial = $state(false)

  private stop: (() => void) | null = null

  watch(client: MatrixClient, roomId: string) {
    this.unwatch()

    const room = client.getRoom(roomId)

    if (!room) {
      return
    }

    const refresh = () => {
      this.view = roomAdmin(client, room)
    }
    const onState = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refresh()
      }
    }

    client.on(RoomStateEvent.Events, onState)
    this.stop = () => client.off(RoomStateEvent.Events, onState)
    refresh()
    void room.loadMembersIfNeeded().then(refresh, () => {
      this.partial = true
    })
  }

  unwatch() {
    this.stop?.()
    this.stop = null
    this.view = null
    this.partial = false
  }
}

export const roomAdminStore = new RoomAdminStore()
