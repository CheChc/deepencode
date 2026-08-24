import type { Context } from "@deepseek-ai/cordis";
export interface TuiRuntimeOptions {
    ctx: Context;
    resumeId?: string;
    quit: (code?: number) => void;
}
/**
 * Owns the terminal surface: alternate-screen layout (scrollable transcript,
 * editor, Hermes-style status bar), global keys, slash commands, the
 * user-question provider and the approval answerer.
 */
export declare class TuiRuntime {
    private readonly ctx;
    private readonly quit;
    private readonly resumeId?;
    private readonly tui;
    private readonly transcript;
    private readonly statusBar;
    private readonly editor;
    private controller?;
    private mode;
    private ctrlCPending;
    private readonly disposers;
    constructor(opts: TuiRuntimeOptions);
    start(): Promise<void>;
    private onSubmit;
    private handleCtrlC;
    private toggleMode;
    private cyclePermission;
    /** Render one question as a terminal option menu; answers promise resolves on pick. */
    private answerQuestions;
    /** Terminal approval dialog: allow once / reject for tool executions. */
    private answerApproval;
    stop(): Promise<void>;
}
//# sourceMappingURL=runner.d.ts.map