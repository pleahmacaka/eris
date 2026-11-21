import type { MatrixClient } from "matrix-js-sdk"
import {
  type CallError,
  CallEvent,
  type CallState,
  type MatrixCall,
} from "matrix-js-sdk/lib/webrtc/call"
import { CallEventHandlerEvent } from "matrix-js-sdk/lib/webrtc/callEventHandler"

export type CallHandlers = {
  onState: (state: CallState) => void
  onStreams: (streams: MediaStream[]) => void
  onHangup: (reason: string | undefined) => void
  onError: (error: CallError) => void
}

export const remoteStreams = (call: MatrixCall) =>
  call.getRemoteFeeds().map(feed => feed.stream)

export const bindCall = (call: MatrixCall, handlers: CallHandlers) => {
  const onState = (state: CallState) => handlers.onState(state)
  const onFeeds = () => handlers.onStreams(remoteStreams(call))
  const onHangup = () => handlers.onHangup(call.hangupReason)
  const onError = (error: CallError) => handlers.onError(error)

  call.on(CallEvent.State, onState)
  call.on(CallEvent.FeedsChanged, onFeeds)
  call.on(CallEvent.Hangup, onHangup)
  call.on(CallEvent.Error, onError)

  return () => {
    call.off(CallEvent.State, onState)
    call.off(CallEvent.FeedsChanged, onFeeds)
    call.off(CallEvent.Hangup, onHangup)
    call.off(CallEvent.Error, onError)
  }
}

export const watchIncomingCalls = (
  client: MatrixClient,
  onIncoming: (call: MatrixCall) => void,
) => {
  client.on(CallEventHandlerEvent.Incoming, onIncoming)

  return () => {
    client.off(CallEventHandlerEvent.Incoming, onIncoming)
  }
}
