import z from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
/**
 * deepencode — opencode-style interactive terminal surface over dsh-base.
 * The runner plugin owns the terminal loop; the startup provider
 * (`deepencode/startup`) parses the inner command line and publishes the
 * `tuiStartup` service this row's lazy config reads.
 * @module deepencode
 */
/** Stable Cordis plugin name. */
export declare const name = "tui-runner";
/** Core services required before the terminal loop can start. */
export declare const inject: string[];
export declare const Config: z<Schemastery.ObjectS<{
    resume: z<string, string>;
}>, Schemastery.ObjectT<{
    resume: z<string, string>;
}>>;
export interface TuiRunnerConfig {
    resume?: string;
}
export declare function apply(ctx: Context, config: TuiRunnerConfig): void;
//# sourceMappingURL=index.d.ts.map