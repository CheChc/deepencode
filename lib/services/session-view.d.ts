import type { Context } from "@deepseek-ai/cordis";
import type { Agent, ModelSelection } from "@deepseek-ai/dsh-agent";
import type { Transcript } from "../ui/transcript.js";
import type { StatusSnapshot } from "../ui/status-bar.js";
export interface SessionControllerOptions {
    ctx: Context;
    resumeId?: string;
    transcript: Transcript;
    onStatus: (snap: StatusSnapshot) => void;
    onModeChanged: (mode: "build" | "plan") => void;
}
/**
 * Owns the live agent: creation/resume, session-event subscription, transcript
 * projection, and the status snapshot the Hermes-style bar renders.
 */
export declare class SessionController {
    private readonly ctx;
    private readonly transcript;
    private readonly onStatus;
    private readonly onModeChanged;
    private readonly mapperState;
    private handle?;
    private agent?;
    private session?;
    private selectionRef;
    private readonly startedAt;
    private turns;
    private steps;
    private contextWindow?;
    private disposers;
    private ticker?;
    private disposed;
    constructor(opts: SessionControllerOptions);
    get agentHandle(): Agent | undefined;
    get turnCount(): number;
    get stepCount(): number;
    get selection(): ModelSelection | undefined;
    /** Mutate the live selection (takes effect on the next step). */
    setSelection(next: ModelSelection): void;
    start(resumeId?: string): Promise<void>;
    /** Cache the active model's context window for the status bar. */
    private refreshContextWindow;
    /** Replay the persisted log into the transcript for a resumed session. */
    private replayHistory;
    private onSessionEvent;
    private applyOps;
    private running;
    /** Send an ordinary user message (triggers a new turn). */
    submit(text: string): void;
    /** Enter plan mode with an optional steering message (mirrors `/plan`). */
    setPlan(active: boolean, steerText?: string): Promise<void>;
    planState(): {
        active: boolean;
        pending?: boolean;
    };
    /** Switch the permission preset for the live session. */
    setPermission(name: string): void;
    currentPermission(): string;
    cancel(): Promise<void>;
    dispose(): Promise<void>;
    private pushMode;
    /** Build the Hermes-style status snapshot from live projections. */
    private pushStatus;
}
//# sourceMappingURL=session-view.d.ts.map