import type { MessageKey } from "#lib/i18n/catalogs.js"
import type { Message } from "#lib/i18n/translate.js"

export type ErrorLike = { errcode?: string; name?: string; message?: string }

export const errorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null
    ? ((error as ErrorLike).errcode ?? (error as ErrorLike).name)
    : undefined

const message = (key: MessageKey): Message => ({ key })

const RATE_LIMITED = message("errors.rateLimited")
const REQUEST_FAILED = message("errors.request.failed")

export const loginError = (code: string | undefined) => {
  switch (code) {
    case "M_FORBIDDEN":
    case "M_USER_DEACTIVATED":
      return message("errors.login.credentials")
    case "M_LIMIT_EXCEEDED":
      return RATE_LIMITED
    default:
      return message("errors.login.unreachable")
  }
}

export const roomError = (code: string | undefined) => {
  switch (code) {
    case "M_FORBIDDEN":
      return message("errors.room.forbidden")
    case "M_NOT_FOUND":
      return message("errors.room.userNotFound")
    case "M_LIMIT_EXCEEDED":
      return RATE_LIMITED
    default:
      return REQUEST_FAILED
  }
}

export const profileError = (code: string | undefined) => {
  switch (code) {
    case "M_TOO_LARGE":
      return message("errors.profile.imageTooLarge")
    case "M_FORBIDDEN":
      return message("errors.profile.forbidden")
    case "M_LIMIT_EXCEEDED":
      return RATE_LIMITED
    default:
      return message("errors.profile.failed")
  }
}

export const actionError = (code: string | undefined) => {
  switch (code) {
    case "M_FORBIDDEN":
      return message("errors.action.forbidden")
    case "M_LIMIT_EXCEEDED":
      return RATE_LIMITED
    default:
      return REQUEST_FAILED
  }
}

export const inviteError = (code: string | undefined) =>
  code === "M_FORBIDDEN" ? message("errors.invite.forbidden") : roomError(code)

export const uploadError = (code: string | undefined) => {
  switch (code) {
    case "M_TOO_LARGE":
      return message("errors.upload.tooLarge")
    case "M_FORBIDDEN":
      return message("errors.upload.forbidden")
    case "M_LIMIT_EXCEEDED":
      return RATE_LIMITED
    default:
      return message("errors.upload.failed")
  }
}

export const GROUP_CALL_UNSUPPORTED = message("errors.call.groupUnsupported")

const microphoneFault = (code: string | undefined) => {
  switch (code) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return message("errors.microphone.denied")
    case "NotFoundError":
    case "DevicesNotFoundError":
      return message("errors.microphone.notFound")
    default:
      return null
  }
}

export const mediaError = (code: string | undefined) =>
  microphoneFault(code) ?? message("errors.call.failed")

export const microphoneError = (code: string | undefined) =>
  microphoneFault(code) ?? message("errors.microphone.busy")

export const DEVICE_SWITCH_ERROR = message("errors.device.switchFailed")
