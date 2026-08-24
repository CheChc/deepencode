import { Command } from "commander";
import { parseCmdline } from "@deepseek-ai/dsh-cmdline";
/**
 * The TUI app's command-line provider: parses `--resume` and `--help`, then
 * publishes {@link TUI_STARTUP_SERVICE}. The runner is an ordinary consumer
 * whose lazy config waits for that service.
 * @module dsh-tui-hermes/startup
 */
/** Stable Cordis plugin name. */
export const name = "tui-startup";
/** Services required before the startup values can resolve. */
export const inject = ["cmdlineArgs"];
/** Service provided by this plugin and injected by the TUI runner. */
export const TUI_STARTUP_SERVICE = "tuiStartup";
function tuiCommand() {
    return new Command()
        .name("dsh --profile tui")
        .description("Interactive terminal session over the dsh agent.")
        .helpOption("-h, --help", "show this help")
        .option("--resume <sessionId>", "resume a persisted session by id")
        .addHelpText("after", `
Examples:
  dsh --profile tui                          start a fresh interactive session
  dsh --profile tui --resume <sessionId>     reopen a persisted session
`);
}
export function apply(ctx) {
    const program = tuiCommand();
    program.action(() => {
        const opts = program.opts();
        ctx.provide(TUI_STARTUP_SERVICE, {
            resume: opts.resume,
        });
    });
    parseCmdline(ctx, program);
}
//# sourceMappingURL=startup.js.map