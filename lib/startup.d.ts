import type { Context } from "@deepseek-ai/cordis";
/**
 * The TUI app's command-line provider: parses `--resume` and `--help`, then
 * publishes {@link TUI_STARTUP_SERVICE}. The runner is an ordinary consumer
 * whose lazy config waits for that service.
 * @module dsh-tui-hermes/startup
 */
/** Stable Cordis plugin name. */
export declare const name = "tui-startup";
/** Services required before the startup values can resolve. */
export declare const inject: string[];
/** Service provided by this plugin and injected by the TUI runner. */
export declare const TUI_STARTUP_SERVICE = "tuiStartup";
export interface TuiStartup {
    /** Resume a persisted session by id instead of creating a fresh one. */
    resume?: string;
}
export declare function apply(ctx: Context): void;
//# sourceMappingURL=startup.d.ts.map