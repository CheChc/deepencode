import type { TUI } from "@earendil-works/pi-tui";
import type { Context } from "@deepseek-ai/cordis";
import type { SessionController } from "./services/session-view.js";
import type { Transcript } from "./ui/transcript.js";
export interface CommandEnv {
    ctx: Context;
    tui: TUI;
    controller: SessionController;
    transcript: Transcript;
    /** Schedule an exit of the whole process. */
    quit(code?: number): void;
}
export interface CommandSpec {
    name: string;
    description: string;
    run(env: CommandEnv, args: string): void | Promise<void>;
}
export declare const COMMANDS: CommandSpec[];
//# sourceMappingURL=commands.d.ts.map