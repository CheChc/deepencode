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
    private readonly terminal;
    private readonly tui;
    private readonly transcript;
    private readonly statusBar;
    private readonly editor;
    private controller?;
    private mode;
    private ctrlCPending;
    private originalBackground?;
    private lastSnap?;
    private spinnerTimer?;
    private spinnerFrame;
    private readonly disposers;
    constructor(opts: TuiRuntimeOptions);
    start(): Promise<void>;
    /**
     * opencode-style dark canvas: repaint the terminal background black via
     * OSC 11. Only applied when the original color could be read, so the
     * original value can always be restored on exit.
     */
    private applyBlackBackground;
    private restoreBackground;
    private onSubmit;
    /** 150ms spinner while a turn is running; pauses when idle. */
    private syncSpinner;
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