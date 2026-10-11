import { requireWindows } from "./apps"
import type { Endpoint } from "./cdp"
import { debugHelp, parseDebugArgs, runDebug } from "./debug-lib"

export async function debugMain(args: string[], endpoint?: Endpoint) {
  try {
    if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
      console.log(debugHelp)
    } else {
      const request = parseDebugArgs(args)
      requireWindows()
      console.log(JSON.stringify(await runDebug(request, endpoint)))
    }
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (import.meta.main) {
  process.exitCode = await debugMain(process.argv.slice(2))
}
