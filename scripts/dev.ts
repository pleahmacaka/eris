import { root } from "./apps"
import { assertPortAvailable, devHelp, devPlan, parseDevArgs } from "./dev-lib"

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    if (args.includes("--help") || args.includes("-h")) {
      console.log(devHelp)
    } else {
      const options = parseDevArgs(args)
      const plan = await devPlan(options)
      if (process.platform === "win32") {
        await assertPortAvailable(options.app)
      }
      const child = Bun.spawn(plan.command, {
        cwd: root,
        env: plan.env,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
      const interrupt = () => child.kill("SIGINT")
      const terminate = () => child.kill("SIGTERM")
      process.on("SIGINT", interrupt)
      process.on("SIGTERM", terminate)
      try {
        process.exitCode = await child.exited
      } finally {
        process.off("SIGINT", interrupt)
        process.off("SIGTERM", terminate)
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
