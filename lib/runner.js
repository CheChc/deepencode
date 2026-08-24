import { CombinedAutocompleteProvider, Editor, Key, ProcessTerminal, ScrollView, TuiAltScreen, VStack, matchesKey, isViewportTUI, } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { SessionController } from "./services/session-view.js";
import { Transcript } from "./ui/transcript.js";
import { StatusBar } from "./ui/status-bar.js";
import { theme, modeText } from "./ui/theme.js";
import { COMMANDS } from "./commands.js";
import { pickOption } from "./ui/dialogs.js";
// Border color follows the session mode: blue = build, orange = plan.
let editorBorder = (s) => chalk.hex("#3b82f6").dim(s);
const editorTheme = {
    borderColor: (s) => editorBorder(s),
    selectList: {
        selectedPrefix: (s) => theme.accent(s),
        selectedText: (s) => theme.accent(s),
        description: (s) => theme.faint(s),
        scrollInfo: (s) => theme.faint(s),
        noMatch: (s) => theme.faint(s),
    },
};
/**
 * Owns the terminal surface: alternate-screen layout (scrollable transcript,
 * editor, Hermes-style status bar), global keys, slash commands, the
 * user-question provider and the approval answerer.
 */
export class TuiRuntime {
    ctx;
    quit;
    resumeId;
    terminal = new ProcessTerminal();
    tui = new TuiAltScreen(this.terminal);
    transcript = new Transcript();
    statusBar = new StatusBar({
        model: "…",
        provider: "…",
        mode: "build",
        permission: "workspace-write",
        context: { used: 0 },
        elapsedSec: 0,
    });
    editor;
    controller;
    mode = "build";
    ctrlCPending = false;
    originalBackground;
    lastSnap;
    spinnerTimer;
    spinnerFrame = 0;
    disposers = [];
    constructor(opts) {
        this.ctx = opts.ctx;
        this.quit = opts.quit;
        this.resumeId = opts.resumeId;
        this.editor = new Editor(this.tui, editorTheme, { paddingX: 0 });
        this.editor.setAutocompleteProvider(new CombinedAutocompleteProvider(COMMANDS.map((c) => ({ name: c.name, description: c.description })), process.cwd()));
        this.editor.onSubmit = (text) => void this.onSubmit(text);
    }
    async start() {
        const tui = this.tui;
        const editorArea = new VStack([
            { component: this.editor, basis: "auto", shrink: 1, minSize: 1 },
            { component: this.statusBar, basis: 1, grow: 0, minSize: 1 },
        ]);
        if (isViewportTUI(tui)) {
            tui.setLayoutRoot(new VStack([
                {
                    component: new ScrollView(this.transcript, { follow: "end", primary: true, overscroll: "chain" }),
                    basis: 0,
                    grow: 1,
                    minSize: 1,
                },
                { component: editorArea, basis: "auto", shrink: 1, minSize: 2 },
            ]));
        }
        // Global keys (run before the focused component, may consume input).
        this.disposers.push(tui.addInputListener((data) => {
            if (matchesKey(data, Key.ctrl("c"))) {
                this.handleCtrlC();
                return { consume: true, data: "" };
            }
            if (matchesKey(data, Key.shift("tab"))) {
                this.cyclePermission();
                return { consume: true, data: "" };
            }
            if (matchesKey(data, Key.tab)) {
                if (this.editor.getText().trim() === "" && !this.editor.isShowingAutocomplete()) {
                    void this.toggleMode();
                    return { consume: true, data: "" };
                }
            }
            return undefined;
        }));
        // The human answerer for ask_user_question (also plan review).
        this.disposers.push(this.ctx.userQuestions.registerProvider({
            ask: (request) => this.answerQuestions(request),
        }));
        // The approval answerer: terminal confirmation dialogs.
        this.disposers.push(this.ctx.on("approval/request", (req, next) => {
            if (!this.controller || !this.controller.agentHandle || req.agent.id !== this.controller.agentHandle.id) {
                return next();
            }
            return this.answerApproval(req);
        }));
        // Live status → Hermes-style bar; mode changes refresh the bar.
        this.controller = new SessionController({
            ctx: this.ctx,
            resumeId: this.resumeId,
            transcript: this.transcript,
            onStatus: (snap) => {
                this.lastSnap = snap;
                this.statusBar.update(snap);
                this.syncSpinner(snap.running ?? false);
            },
            onModeChanged: (mode) => {
                this.mode = mode;
                editorBorder = mode === "plan" ? (s) => chalk.hex("#ea580c").dim(s) : (s) => chalk.hex("#3b82f6").dim(s);
                this.editor.borderColor = editorBorder;
            },
        });
        await this.controller.start(this.resumeId);
        // Hermes-style welcome banner: product identity, model, workspace, hints.
        const cwd = process.cwd().replace(process.env.HOME ?? "~", "~");
        const sel = this.controller.selection;
        this.transcript.append({
            kind: "welcome",
            lines: [
                `${theme.accent("╭─")} ${theme.accent.bold("deepencode")} ${theme.faint("· DeepSeek Harness TUI")}`,
                `${theme.accent("│")} 模型 ${sel ? `${sel.model}${sel.reasoningEffort ? ` (${sel.reasoningEffort})` : ""}` : "…"}${theme.faint(" · ")}${cwd}`,
                `${theme.accent("│")} ${theme.faint("Tab build⇄plan · Shift+Tab 权限 · /help · Ctrl+C 取消/退出")}`,
                `${theme.accent("╰─")}`,
            ],
        });
        tui.setFocus(this.editor);
        tui.start();
        void this.applyBlackBackground();
    }
    /**
     * opencode-style dark canvas: repaint the terminal background black via
     * OSC 11. Only applied when the original color could be read, so the
     * original value can always be restored on exit.
     */
    async applyBlackBackground() {
        try {
            const original = await this.tui.queryTerminalBackgroundColor({ timeoutMs: 800 });
            if (original === undefined)
                return;
            this.originalBackground = original;
            this.terminal.write("\x1b]11;rgb:0000/0000/0000\x1b\\");
        }
        catch {
            /* unsupported terminal: per-line bg padding still applies */
        }
    }
    restoreBackground() {
        if (!this.originalBackground)
            return;
        const { r, g, b } = this.originalBackground;
        const hex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
        this.terminal.write(`\x1b]11;rgb:${hex(r)}${hex(r)}/${hex(g)}${hex(g)}/${hex(b)}${hex(b)}\x1b\\`);
    }
    async onSubmit(text) {
        const trimmed = text.trim();
        if (trimmed === "") {
            this.tui.requestRender();
            return;
        }
        if (trimmed.startsWith("/")) {
            const [rawName, ...rest] = trimmed.slice(1).split(/\s+/);
            const name = rawName.toLowerCase();
            const command = COMMANDS.find((c) => c.name === name);
            if (command) {
                this.editor.addToHistory(text);
                this.editor.setText("");
                const env = {
                    ctx: this.ctx,
                    tui: this.tui,
                    controller: this.controller,
                    transcript: this.transcript,
                    quit: this.quit,
                };
                try {
                    await command.run(env, rest.join(" "));
                }
                catch (error) {
                    this.transcript.append({ kind: "system", text: `命令失败: ${error instanceof Error ? error.message : String(error)}` });
                    this.tui.requestRender();
                }
                return;
            }
            // Unknown slash command → send as a plain message.
            this.transcript.append({ kind: "system", text: `未知命令 /${name},已按普通消息发送` });
        }
        this.editor.addToHistory(text);
        this.editor.setText("");
        try {
            this.controller?.submit(text);
        }
        catch (error) {
            this.transcript.append({ kind: "system", text: `提交失败: ${error instanceof Error ? error.stack ?? error.message : String(error)}` });
        }
        this.tui.requestRender();
    }
    /** 150ms spinner while a turn is running; pauses when idle. */
    syncSpinner(running) {
        if (running && !this.spinnerTimer) {
            this.spinnerTimer = setInterval(() => {
                if (!this.lastSnap)
                    return;
                this.spinnerFrame += 1;
                this.lastSnap = { ...this.lastSnap, spinnerFrame: this.spinnerFrame };
                this.statusBar.update(this.lastSnap);
            }, 150);
        }
        else if (!running && this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = undefined;
        }
    }
    handleCtrlC() {
        if (this.controller?.agentHandle && this.controller.agentHandle.status === "running") {
            if (this.ctrlCPending) {
                this.transcript.append({ kind: "system", text: "强制退出…" });
                this.quit(0);
                return;
            }
            this.ctrlCPending = true;
            void this.controller.cancel();
            this.transcript.append({ kind: "system", text: "正在取消…(再按一次 Ctrl+C 退出)" });
            this.tui.requestRender();
            setTimeout(() => (this.ctrlCPending = false), 1500);
        }
        else {
            this.transcript.append({ kind: "system", text: "再见!" });
            this.quit(0);
        }
    }
    async toggleMode() {
        const target = this.mode === "plan" ? "build" : "plan";
        await this.controller?.setPlan(target === "plan");
        this.transcript.append({ kind: "system", text: `模式 → ${modeText(target, target.toUpperCase())}${target === "plan" ? " (只读规划)" : ""}` });
        this.tui.requestRender();
    }
    cyclePermission() {
        const order = ["read-only", "workspace-write", "danger-full-access"];
        const current = this.controller?.currentPermission() ?? "workspace-write";
        const next = order[(order.indexOf(current) + 1) % order.length];
        this.controller?.setPermission(next);
        this.transcript.append({ kind: "system", text: `权限 → ${next}` });
        this.tui.requestRender();
    }
    /** Render one question as a terminal option menu; answers promise resolves on pick. */
    answerQuestions(request) {
        return new Promise((resolve) => {
            const question = request.questions[0];
            if (!question) {
                resolve({ answers: [] });
                return;
            }
            const isPlanReview = question.intent?.kind === "plan-review";
            const title = isPlanReview ? "📋 批准计划" : question.header ?? "需要你的决定";
            const options = (question.options ?? []).map((o) => ({
                value: o.label,
                label: o.label,
                description: o.description,
            }));
            if (options.length === 0 && !isPlanReview) {
                options.push({ value: question.question, label: "OK" });
            }
            const body = isPlanReview ? question.question : question.question + (question.detail ? `\n${question.detail}` : "");
            const askOne = () => {
                pickOption(this.tui, title, body, options.length > 0 ? options : [{ value: "Approve", label: "Approve" }], (selected) => {
                    resolve({ answers: [{ id: question.id, selected: [selected] }] });
                }, () => {
                    // Escape skips this question with an empty selection.
                    resolve({ answers: [{ id: question.id, selected: [] }] });
                }, isPlanReview ? "orange" : "blue");
            };
            askOne();
            request.signal?.addEventListener("abort", () => {
                resolve({ answers: [{ id: question.id, selected: [] }] });
            });
        });
    }
    /** Terminal approval dialog: allow once / reject for tool executions. */
    answerApproval(req) {
        return new Promise((resolve) => {
            const title = `允许执行工具 ${req.toolName}?`;
            const body = req.reason ?? "(no reason given)";
            pickOption(this.tui, title, body, [
                { value: "allowed-once", label: "允许一次" },
                { value: "rejected", label: "拒绝" },
            ], (value) => resolve(value), () => resolve("cancelled"), "orange");
            req.signal?.addEventListener("abort", () => resolve("cancelled"));
        });
    }
    async stop() {
        try {
            await this.controller?.dispose();
        }
        catch {
            /* noop */
        }
        for (const dispose of this.disposers) {
            try {
                dispose();
            }
            catch {
                /* noop */
            }
        }
        if (this.spinnerTimer)
            clearInterval(this.spinnerTimer);
        this.spinnerTimer = undefined;
        this.disposers.length = 0;
        this.restoreBackground();
        this.tui.stop();
    }
}
//# sourceMappingURL=runner.js.map