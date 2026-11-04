const ESC = String.fromCharCode(27)

// ConPTY reads a lone ESC byte as the start of a sequence and merges it with the next key, so Escape goes as the win32-input-mode record Windows Terminal sends
const ESCAPE_RECORD = `${ESC}[27;1;27;1;0;1_${ESC}[27;1;27;0;0;1_`

export const conpty = (shell: string) =>
  navigator.userAgent.includes("Windows") && !shell.startsWith("serial:")

export const escapeKey = (shell: string) =>
  conpty(shell) ? ESCAPE_RECORD : ESC
