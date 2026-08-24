import z from "@deepseek-ai/schemastery";
import { TuiRuntime } from "./runner.js";
/**
 * deepencode — opencode-style interactive terminal surface over dsh-base.
 * The runner plugin owns the terminal loop; the startup provider
 * (`deepencode/startup`) parses the inner command line and publishes the
 * `tuiStartup` service this row's lazy config reads.
 * @module deepencode
 */
/** Stable Cordis plugin name. */
export const name = "tui-runner";
/** Core services required before the terminal loop can start. */
export const inject = [
    "tuiStartup",
    "agents",
    "sessions",
    "llm",
    "planMode",
    "permissionPresets",
    "userQuestions",
    "agentDefaultModel",
    "sessionQuery",
    "sessionProjections",
    "settings",
];
export const Config = z.object({
    // schemastery fields are optional by default; the row's lazy config may
    // leave resume absent for a fresh session.
    resume: z.string(),
});
export function apply(ctx, config) {
    const exit = ctx.get("appExit");
    if (exit === undefined) {
        throw new Error("tui-runner: the launcher must provide ctx.appExit before the tree mounts");
    }
    const runtime = new TuiRuntime({
        ctx,
        resumeId: config.resume,
        quit: (code) => {
            void runtime
                .stop()
                .catch(() => { })
                .finally(() => exit(code ?? 0));
        },
    });
    void runtime.start().catch((error) => {
        ctx.logger("tui-runner").error(error);
        exit(1);
    });
}
//# sourceMappingURL=index.js.map