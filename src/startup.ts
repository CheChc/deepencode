import { Command } from "commander";
import { parseCmdline } from "@deepseek-ai/dsh-cmdline";
import type { Context } from "@deepseek-ai/cordis";

/**
 * The TUI app's command-line provider: parses `--resume` and `--help`, then
 * publishes {@link TUI_STARTUP_SERVICE}. The runner is an ordinary consumer
 * whose lazy config waits for that service.
 * @module deepencode/startup
 */

/** Stable Cordis plugin name. */
export const name = "tui-startup";

/** Services required before the startup values can resolve. */
export const inject = ["cmdlineArgs"];

/** Service provided by this plugin and injected by the TUI runner. */
export const TUI_STARTUP_SERVICE = "tuiStartup";

export interface TuiStartup {
  /** Resume a persisted session by id instead of creating a fresh one. */
  resume?: string;
}

function tuiCommand() {
  return new Command()
    .name("dsh --profile tui")
    .description("DeepSeek Harness 的交互式终端界面。")
    .helpOption("-h, --help", "show this help")
    .option("--resume <sessionId>", "按会话 id 恢复持久化会话")
    .addHelpText(
      "after",
      `
示例:
  dsh --profile tui                          开启新会话
  dsh --profile tui --resume <sessionId>     恢复已有会话
`,
    );
}

export function apply(ctx: Context): void {
  const program = tuiCommand();
  program.action(() => {
    const opts = program.opts<{ resume?: string }>();
    ctx.provide(TUI_STARTUP_SERVICE, {
      resume: opts.resume,
    } satisfies TuiStartup);
  });
  parseCmdline(ctx, program);
}
