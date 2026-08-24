import { randomUUID } from "node:crypto";
import { SessionId } from "@deepseek-ai/dsh-session";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { mapEvent } from "./event-mapper.js";
/**
 * Owns the live agent: creation/resume, session-event subscription, transcript
 * projection, and the status snapshot the Hermes-style bar renders.
 */
export class SessionController {
    ctx;
    transcript;
    onStatus;
    onModeChanged;
    mapperState = { tools: new Map() };
    handle;
    agent;
    session;
    selectionRef = { current: undefined, assembled: undefined };
    startedAt = Date.now();
    turns = 0;
    steps = 0;
    contextWindow;
    disposers = [];
    ticker;
    disposed = false;
    constructor(opts) {
        this.ctx = opts.ctx;
        this.transcript = opts.transcript;
        this.onStatus = opts.onStatus;
        this.onModeChanged = opts.onModeChanged;
    }
    get agentHandle() {
        return this.agent;
    }
    get turnCount() {
        return this.turns;
    }
    get stepCount() {
        return this.steps;
    }
    get selection() {
        return this.selectionRef.current;
    }
    /** Mutate the live selection (takes effect on the next step). */
    setSelection(next) {
        this.selectionRef.current = { ...next };
        this.pushStatus();
        void this.refreshContextWindow();
    }
    async start(resumeId) {
        await this.ctx.get("loader")?.await();
        const defaultModel = this.ctx.agentDefaultModel.currentSelection();
        this.selectionRef.current = { provider: defaultModel.provider, model: defaultModel.model, reasoningEffort: defaultModel.reasoningEffort };
        const setup = (agentCtx) => {
            installModelSelection(agentCtx, this.selectionRef);
        };
        if (resumeId) {
            this.handle = await this.ctx.agents.resume({
                resumeSessionId: SessionId(resumeId),
                setup,
            });
        }
        else {
            this.handle = await this.ctx.agents.create({
                sessionId: SessionId(`session-${randomUUID()}`),
                meta: { cwd: process.cwd() },
                agentOptions: { provider: defaultModel.provider, model: defaultModel.model },
                setup,
            });
        }
        this.agent = this.handle.agent;
        this.session = this.agent.session;
        this.disposers.push(this.ctx.on("session/event", (session, event) => {
            if (this.session && session.id !== this.session.id)
                return;
            this.onSessionEvent(event);
        }));
        if (resumeId)
            this.replayHistory();
        this.ticker = setInterval(() => this.pushStatus(), 1000);
        this.pushStatus();
        this.pushMode();
        // Resolve the context window once so the bar shows used/max immediately.
        void this.refreshContextWindow();
    }
    /** Cache the active model's context window for the status bar. */
    async refreshContextWindow() {
        const sel = this.selectionRef.current;
        if (!sel)
            return;
        try {
            const info = await this.ctx.llm.resolveModelInfo(sel.provider, sel.model);
            if (info.context?.contextWindow) {
                this.contextWindow = info.context.contextWindow;
                this.pushStatus();
            }
        }
        catch {
            /* adapter may not advertise capacity */
        }
    }
    /** Replay the persisted log into the transcript for a resumed session. */
    replayHistory() {
        if (!this.session)
            return;
        for (const event of this.session.events) {
            this.applyOps(mapEvent(event, this.mapperState, this.transcript.size), event);
        }
    }
    onSessionEvent(event) {
        if (event.type === "turn/start") {
            this.running(true);
        }
        else if (event.type === "turn/end") {
            this.running(false);
            this.turns += 1;
        }
        else if (event.type === "step/start") {
            this.steps += 1;
        }
        this.applyOps(mapEvent(event, this.mapperState, this.transcript.size), event);
        this.pushStatus();
    }
    applyOps(ops, _event) {
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
                        }
                        else {
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
    running(flag) {
        this.pushStatus();
    }
    /** Send an ordinary user message (triggers a new turn). */
    submit(text) {
        if (!this.agent)
            return;
        this.transcript.append({ kind: "user", text });
        this.agent.followup(createUserMessage({
            content: [{ type: "text", text }],
            source: { kind: "user" },
        }));
    }
    /** Enter plan mode with an optional steering message (mirrors `/plan`). */
    async setPlan(active, steerText) {
        if (!this.agent)
            return;
        this.ctx.planMode.set(this.agent, active);
        if (active && steerText && steerText.trim() !== "") {
            this.agent.steer(createUserMessage({
                content: [{ type: "text", text: steerText }],
                source: { kind: "user" },
            }));
        }
        this.pushStatus();
        this.pushMode();
    }
    planState() {
        if (!this.agent)
            return { active: false };
        return this.ctx.planMode.get(this.agent);
    }
    /** Switch the permission preset for the live session. */
    setPermission(name) {
        if (!this.session)
            return;
        this.ctx.permissionPresets.set(this.session, name);
        this.pushStatus();
    }
    currentPermission() {
        if (!this.session)
            return "workspace-write";
        try {
            return this.ctx.permissionPresets.current(this.session.events);
        }
        catch {
            return "workspace-write";
        }
    }
    async cancel() {
        if (!this.agent)
            return;
        this.agent.cancel({ kind: "user" });
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        if (this.ticker)
            clearInterval(this.ticker);
        for (const dispose of this.disposers) {
            try {
                dispose();
            }
            catch {
                /* noop */
            }
        }
        this.disposers = [];
        if (this.handle)
            await this.handle.dispose();
    }
    pushMode() {
        this.onModeChanged(this.planState().active ? "plan" : "build");
    }
    /** Build the Hermes-style status snapshot from live projections. */
    pushStatus() {
        if (!this.session || !this.agent)
            return;
        const proj = this.ctx.sessionProjections;
        let cacheHit;
        let contextWindow;
        let used;
        try {
            const usage = proj.stateOf(this.session, "tokenUsage");
            const totals = usage?.totals;
            if (totals) {
                const cacheRead = totals.cacheReadTokens ?? 0;
                const uncached = totals.uncachedInputTokens ?? 0;
                if (cacheRead + uncached > 0)
                    cacheHit = cacheRead / (cacheRead + uncached);
            }
        }
        catch {
            /* projection may be pending */
        }
        try {
            const pressure = proj.stateOf(this.session, "contextPressure");
            contextWindow = pressure?.contextWindow;
            used = pressure?.pressureTokens ?? pressure?.surfaceTokens;
        }
        catch {
            /* projection may be pending */
        }
        const sel = this.selectionRef.current;
        const plan = this.planState();
        this.onStatus({
            model: sel?.model ?? "…",
            provider: sel?.provider ?? "…",
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
//# sourceMappingURL=session-view.js.map