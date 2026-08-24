import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";
import type { Session, SessionEvent } from "@deepseek-ai/dsh-session";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import type { Agent, AgentHandle, ModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { Transcript } from "../ui/transcript.js";
import type { StatusSnapshot } from "../ui/status-bar.js";
import { mapEvent } from "./event-mapper.js";
import type { MapperState } from "./event-mapper.js";

// Load the module augmentations these ctx services rely on for typing.
import type {} from "@deepseek-ai/dsh-plan-mode";
import type {} from "@deepseek-ai/dsh-permission-presets";
import type {} from "@deepseek-ai/dsh-session-projection";
import type {} from "@deepseek-ai/dsh-token-meter";

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
export class SessionController {
  private readonly ctx: Context;
  private readonly transcript: Transcript;
  private readonly onStatus: (s: StatusSnapshot) => void;
  private readonly onModeChanged: (mode: "build" | "plan") => void;
  private readonly mapperState: MapperState = { tools: new Map() };

  private handle?: AgentHandle;
  private agent?: Agent;
  private session?: Session;
  private selectionRef: { current: ModelSelection | undefined; assembled: ModelSelection | undefined } = { current: undefined, assembled: undefined };

  private readonly startedAt = Date.now();
  private turns = 0;
  private steps = 0;
  private contextWindow?: number;
  /** Eagerly rendered user inputs awaiting their matching user/message event. */
  private readonly submittedQueue: string[] = [];
  private disposers: Array<() => void> = [];
  private ticker?: ReturnType<typeof setInterval>;
  private disposed = false;

  constructor(opts: SessionControllerOptions) {
    this.ctx = opts.ctx;
    this.transcript = opts.transcript;
    this.onStatus = opts.onStatus;
    this.onModeChanged = opts.onModeChanged;
  }

  get agentHandle(): Agent | undefined {
    return this.agent;
  }

  get turnCount(): number {
    return this.turns;
  }

  get stepCount(): number {
    return this.steps;
  }

  get selection(): ModelSelection | undefined {
    return this.selectionRef.current;
  }

  /** Mutate the live selection (takes effect on the next step). */
  setSelection(next: ModelSelection): void {
    this.selectionRef.current = { ...next };
    this.pushStatus();
    void this.refreshContextWindow();
  }

  async start(resumeId?: string): Promise<void> {
    await this.ctx.get("loader")?.await();
    const defaultModel = this.ctx.agentDefaultModel.currentSelection();
    this.selectionRef.current = { provider: defaultModel.provider, model: defaultModel.model, reasoningEffort: defaultModel.reasoningEffort };

    const setup = (agentCtx: Context) => {
      installModelSelection(agentCtx, this.selectionRef);
    };

    if (resumeId) {
      this.handle = await this.ctx.agents.resume({
        resumeSessionId: SessionId(resumeId),
        setup,
      });
    } else {
      this.handle = await this.ctx.agents.create({
        sessionId: SessionId(`session-${randomUUID()}`),
        meta: { cwd: process.cwd() },
        agentOptions: { provider: defaultModel.provider, model: defaultModel.model },
        setup,
      });
    }
    this.agent = this.handle.agent;
    this.session = this.agent.session;

    this.disposers.push(
      this.ctx.on("session/event", (session: Session, event: SessionEvent) => {
        if (this.session && session.id !== this.session.id) return;
        this.onSessionEvent(event);
      }),
    );

    if (resumeId) this.replayHistory();

    this.ticker = setInterval(() => this.pushStatus(), 1000);
    this.pushStatus();
    this.pushMode();
    // Resolve the context window once so the bar shows used/max immediately.
    void this.refreshContextWindow();
  }

  /** Cache the active model's context window for the status bar. */
  private async refreshContextWindow(): Promise<void> {
    const sel = this.selectionRef.current;
    if (!sel) return;
    try {
      const info = await this.ctx.llm.resolveModelInfo(sel.provider, sel.model);
      if (info.context?.contextWindow) {
        this.contextWindow = info.context.contextWindow;
        this.pushStatus();
      }
    } catch {
      /* adapter may not advertise capacity */
    }
  }

  /** Replay the persisted log into the transcript for a resumed session. */
  private replayHistory(): void {
    if (!this.session) return;
    for (const event of this.session.events) {
      this.applyOps(mapEvent(event, this.mapperState, this.transcript.size), event);
    }
  }

  private onSessionEvent(event: SessionEvent): void {
    // Dedupe eagerly rendered user inputs: the session log replays the same
    // message as user/message, so consume the oldest queued input on match.
    if (event.type === "user/message") {
      const data = event.data as { source?: { kind?: string }; content?: Array<{ type?: string; text?: string }> };
      if (data.source?.kind === "user") {
        const text = (data.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("");
        if (this.submittedQueue.length > 0 && this.submittedQueue[0] === text) {
          this.submittedQueue.shift();
          this.pushStatus();
          return;
        }
      }
    }
    if (event.type === "turn/start") {
      this.running(true);
    } else if (event.type === "turn/end") {
      this.running(false);
      this.turns += 1;
    } else if (event.type === "step/start") {
      this.steps += 1;
    }
    this.applyOps(mapEvent(event, this.mapperState, this.transcript.size), event);
    this.pushStatus();
  }

  private applyOps(ops: ReturnType<typeof mapEvent>, _event: SessionEvent): void {
    for (const op of ops) {
      switch (op.op) {
        case "append":
          this.transcript.append(op.item);
          break;
        case "update":
          if (op.index >= 0) {
            // Update-in-place only when it targets the current tail item.
            if (op.index === this.transcript.size - 1) {
              this.transcript.updateLast(op.item);
            } else {
              this.transcript.append(op.item);
            }
          }
          break;
        case "system":
          this.transcript.append({ kind: "system", text: op.text });
          break;
        case "divider":
          this.transcript.append({ kind: "divider", text: op.text });
          break;
      }
    }
  }

  private running(flag: boolean): void {
    this.pushStatus();
  }

  /** Send an ordinary user message (triggers a new turn). */
  submit(text: string): void {
    if (!this.agent) return;
    // Eager render for instant feedback; the matching user/message event is
    // deduped below so the line never appears twice.
    this.transcript.append({ kind: "user", text });
    this.submittedQueue.push(text);
    this.agent.followup(
      createUserMessage({
        content: [{ type: "text", text }],
        source: { kind: "user" },
      }),
    );
  }

  /** Enter plan mode with an optional steering message (mirrors `/plan`). */
  async setPlan(active: boolean, steerText?: string): Promise<void> {
    if (!this.agent) return;
    this.ctx.planMode.set(this.agent, active);
    if (active && steerText && steerText.trim() !== "") {
      this.agent.steer(
        createUserMessage({
          content: [{ type: "text", text: steerText }],
          source: { kind: "user" },
        }),
      );
    }
    this.pushStatus();
    this.pushMode();
  }

  planState(): { active: boolean; pending?: boolean } {
    if (!this.agent) return { active: false };
    return this.ctx.planMode.get(this.agent);
  }

  /** Switch the permission preset for the live session. */
  setPermission(name: string): void {
    if (!this.session) return;
    this.ctx.permissionPresets.set(this.session, name);
    this.pushStatus();
  }

  currentPermission(): string {
    if (!this.session) return "workspace-write";
    try {
      return this.ctx.permissionPresets.current(this.session.events);
    } catch {
      return "workspace-write";
    }
  }

  async cancel(): Promise<void> {
    if (!this.agent) return;
    this.agent.cancel({ kind: "user" });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.ticker) clearInterval(this.ticker);
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch {
        /* noop */
      }
    }
    this.disposers = [];
    if (this.handle) await this.handle.dispose();
  }

  private pushMode(): void {
    this.onModeChanged(this.planState().active ? "plan" : "build");
  }

  /** Build the Hermes-style status snapshot from live projections. */
  private pushStatus(): void {
    if (!this.session || !this.agent) return;
    const proj = this.ctx.sessionProjections;
    let cacheHit: number | undefined;
    let contextWindow: number | undefined;
    let used: number | undefined;

    try {
      const usage = proj.stateOf(this.session, "tokenUsage");
      const totals = usage?.totals;
      if (totals) {
        const cacheRead = totals.cacheReadTokens ?? 0;
        const uncached = totals.uncachedInputTokens ?? 0;
        if (cacheRead + uncached > 0) cacheHit = cacheRead / (cacheRead + uncached);
      }
    } catch {
      /* projection may be pending */
    }
    try {
      const pressure = proj.stateOf(this.session, "contextPressure");
      contextWindow = pressure?.contextWindow;
      used = pressure?.pressureTokens ?? pressure?.surfaceTokens;
    } catch {
      /* projection may be pending */
    }

    const sel = this.selectionRef.current;
    const plan = this.planState();
    this.onStatus({
      model: sel?.model ?? "…",
      provider: sel?.provider ?? "…",
      effort: sel?.reasoningEffort,
      mode: plan.active ? "plan" : "build",
      permission: this.currentPermission(),
      context: { used: used ?? 0, max: contextWindow ?? this.contextWindow },
      cacheHit,
      elapsedSec: (Date.now() - this.startedAt) / 1000,
      running: this.agent.status === "running",
      yolo: this.currentPermission() === "danger-full-access",
      turns: this.turns,
      steps: this.steps,
    });
  }
}
