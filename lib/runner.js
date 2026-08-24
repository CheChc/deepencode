import { CombinedAutocompleteProvider, Editor, Key, ProcessTerminal, ScrollView, TuiAltScreen, VStack, matchesKey, isViewportTUI, } from "@earendil-works/pi-tui";
import { SessionController } from "./services/session-view.js";
import { Transcript } from "./ui/transcript.js";
import { StatusBar } from "./ui/status-bar.js";
import { theme } from "./ui/theme.js";
import { COMMANDS } from "./commands.js";
import { pickOption } from "./ui/dialogs.js";
const editorTheme = {
    borderColor: (s) => theme.faint(s),
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
    tui = new TuiAltScreen(new ProcessTerminal());
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
            onStatus: (snap) => this.statusBar.update(snap),
            onModeChanged: (mode) => {
                this.mode = mode;
            },
        });
        await this.controller.start(this.resumeId);
        this.transcript.append({ kind: "divider", text: `DeepSeek Harness TUI · ${process.cwd()}` });
        this.transcript.append({ kind: "system", text: "Tab 切换 build/plan · Shift+Tab 切换权限 · /help 查看命令 · Ctrl+C 取消/退出" });
        tui.setFocus(this.editor);
        tui.start();
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
        this.transcript.append({ kind: "system", text: `模式 → ${target.toUpperCase()}${target === "plan" ? " (只读规划)" : ""}` });
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
                });
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
            ], (value) => resolve(value), () => resolve("cancelled"));
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
        this.disposers.length = 0;
        this.tui.stop();
    }
}
//# sourceMappingURL=runner.js.map