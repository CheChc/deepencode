import { truncateToWidth } from "@earendil-works/pi-tui";
import { listModels, listProviders, resolveModelMeta } from "./services/models.js";
import { pickOne, pickOption, promptText } from "./ui/dialogs.js";
import { theme } from "./ui/theme.js";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
export const COMMANDS = [
    {
        name: "help",
        description: "list slash commands",
        run(env) {
            const lines = COMMANDS.map((c) => theme.accent(`/${c.name}`) + theme.faint(` — ${c.description}`));
            env.transcript.append({ kind: "system", text: lines.join("\n") });
            env.tui.requestRender();
        },
    },
    {
        name: "plan",
        description: "enter plan mode (off = exit; text = enter + steer)",
        run(env, args) {
            const trimmed = args.trim();
            if (trimmed === "off") {
                void env.controller.setPlan(false);
                env.transcript.append({ kind: "system", text: "已退出 plan 模式 → build" });
            }
            else {
                void env.controller.setPlan(true, trimmed === "" ? undefined : trimmed);
                env.transcript.append({ kind: "system", text: trimmed === "" ? "已进入 plan 模式(只读规划,批准后切回 build)" : `已进入 plan 模式并提交:${truncateToWidth(trimmed, 60)}` });
            }
            env.tui.requestRender();
        },
    },
    {
        name: "model",
        description: "pick provider / model / reasoning effort",
        async run(env) {
            const providers = listProviders(env.ctx);
            if (providers.length === 0) {
                env.transcript.append({ kind: "system", text: "没有可用模型供应商" });
                env.tui.requestRender();
                return;
            }
            pickOne(env.tui, "选择供应商", providers.map((p) => ({ value: p.provider, label: p.live ? p.displayName : `${p.displayName} (未配置)`, description: p.provider })), (provider) => void pickModel(env, provider));
        },
    },
    {
        name: "provider",
        description: "manage third-party providers: add / rm",
        async run(env, args) {
            const [sub, ...rest] = args.trim().split(/\s+/);
            if (sub === "add") {
                void addProviderFlow(env);
            }
            else if (sub === "rm" || sub === "remove") {
                void removeProviderFlow(env);
            }
            else {
                env.transcript.append({ kind: "system", text: "用法: /provider add | /provider rm" });
                env.tui.requestRender();
            }
        },
    },
    {
        name: "permissions",
        description: "switch permission preset: read-only / workspace-write / danger-full-access",
        run(env, args) {
            const names = ["read-only", "workspace-write", "danger-full-access"];
            const target = args.trim();
            if (names.includes(target)) {
                env.controller.setPermission(target);
                env.transcript.append({ kind: "system", text: `权限预设 → ${target}` });
                env.tui.requestRender();
                return;
            }
            pickOption(env.tui, "切换权限预设", `当前:${env.controller.currentPermission()}`, names.map((n) => ({ value: n, label: n })), (value) => {
                env.controller.setPermission(value);
                env.transcript.append({ kind: "system", text: `权限预设 → ${value}` });
                env.tui.requestRender();
            });
        },
    },
    {
        name: "sessions",
        description: "list persisted sessions and resume one",
        async run(env) {
            let records = [];
            try {
                records = (await env.ctx.sessionQuery.listSessions());
            }
            catch {
                /* listing unavailable */
            }
            if (records.length === 0) {
                env.transcript.append({ kind: "system", text: "没有可恢复的会话" });
                env.tui.requestRender();
                return;
            }
            pickOne(env.tui, "恢复会话(将替换当前会话)", records.map((r) => ({
                value: r.id,
                label: r.title ?? r.id,
                description: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : undefined,
            })), (_value) => {
                env.transcript.append({ kind: "system", text: "会话切换将在退出后生效 —— v1 请用 dsh --profile tui --resume <id> 恢复" });
                env.tui.requestRender();
            });
        },
    },
    {
        name: "status",
        description: "show session info (model / mode / permission / counters)",
        run(env) {
            const snap = env.controller.planState();
            const ctl = env.controller;
            env.transcript.append({
                kind: "system",
                text: [
                    `模式: ${snap.active ? "plan" : "build"}${snap.pending ? " (pending)" : ""}`,
                    `权限: ${env.controller.currentPermission()}`,
                    `模型: ${env.controller.selection?.provider}/${env.controller.selection?.model}${env.controller.selection?.reasoningEffort ? ` · ${env.controller.selection.reasoningEffort}` : ""}`,
                    `轮次: ${ctl.turnCount} · 步骤: ${ctl.stepCount}`,
                ].join("\n"),
            });
            env.tui.requestRender();
        },
    },
    {
        name: "quit",
        description: "exit the TUI",
        run(env) {
            env.quit(0);
        },
    },
];
async function pickModel(env, provider) {
    const models = await listModels(env.ctx, provider);
    if (models.length === 0) {
        env.transcript.append({ kind: "system", text: `供应商 ${provider} 没有可用模型` });
        env.tui.requestRender();
        return;
    }
    pickOne(env.tui, `选择模型 · ${provider}`, models.map((m) => ({ value: `${provider}\u0000${m.id}`, label: m.name, description: m.id })), async (value) => {
        const model = value.split("\u0000")[1];
        const meta = await resolveModelMeta(env.ctx, provider, model);
        const efforts = meta.reasoningEfforts ?? [];
        const pickEffort = () => pickOne(env.tui, `推理强度 · ${model}`, [{ value: "", label: "默认", description: "跟随模型默认" }, ...efforts.map((e) => ({ value: e.id, label: e.name }))], (effort) => {
            const choice = { provider, model, reasoningEffort: effort === "" ? undefined : effort };
            env.controller.setSelection(choice);
            void applyDefault(env, choice);
            env.transcript.append({ kind: "system", text: `模型 → ${provider}/${model}${effort ? ` (${effort})` : ""}` });
            env.tui.requestRender();
        });
        if (efforts.length === 0) {
            const choice = { provider, model };
            env.controller.setSelection(choice);
            void applyDefault(env, choice);
            env.transcript.append({ kind: "system", text: `模型 → ${provider}/${model}` });
            env.tui.requestRender();
        }
        else {
            pickEffort();
        }
    });
}
async function applyDefault(env, choice) {
    try {
        await env.ctx.agentDefaultModel.saveSelection({ ...choice });
    }
    catch {
        /* persistence optional */
    }
}
async function addProviderFlow(env) {
    promptText(env.tui, "新供应商 route(如 openai 或 my-gateway)", "", (route) => {
        promptText(env.tui, "baseURL(如 https://api.openai.com/v1)", "", (baseURL) => {
            promptText(env.tui, "API Key 环境变量名(如 OPENAI_API_KEY)", "OPENAI_API_KEY", (apiKeyEnv) => {
                promptText(env.tui, "模型列表,逗号分隔(如 gpt-4o,gpt-4o-mini;已知路由如 openai/anthropic 可留空)", "", async (modelsRaw) => {
                    try {
                        const section = env.ctx.settings.get(settingsNamespace("llm-pi-ai"));
                        const providers = { ...(section?.providers ?? {}) };
                        const entry = { apiKeyEnv, baseURL };
                        // Unknown routes must declare the wire protocol; OpenAI-compatible
                        // endpoints are the common case. Known catalog routes infer it.
                        const known = listProviders(env.ctx).some((p) => p.provider === route && p.live);
                        if (!known)
                            entry.api = "openai-completions";
                        const models = modelsRaw.split(",").map((s) => s.trim()).filter((s) => s !== "");
                        if (models.length > 0) {
                            entry.models = models.map((id) => {
                                const [modelId, contextWindow] = id.split(":");
                                return contextWindow ? { id: modelId, contextWindow: Number(contextWindow) } : { id: modelId };
                            });
                        }
                        providers[route] = entry;
                        await env.ctx.settings.mutate(settingsNamespace("llm-pi-ai"), [
                            { op: "set", path: ["providers"], value: providers },
                        ]);
                        env.transcript.append({ kind: "system", text: `已添加供应商 ${route} (${baseURL});生效后可用 /model 选择` });
                        env.tui.requestRender();
                    }
                    catch (error) {
                        env.transcript.append({ kind: "system", text: `添加失败: ${error instanceof Error ? error.message : String(error)}` });
                        env.tui.requestRender();
                    }
                });
            });
        });
    });
}
async function removeProviderFlow(env) {
    const providers = listProviders(env.ctx);
    // Only live, user-configured routes are removable — the dormant directory
    // entries (openai/anthropic/…) are the adapter's known-route catalog.
    const removable = providers.filter((p) => p.provider !== "deepseek-official" && p.live);
    if (removable.length === 0) {
        env.transcript.append({ kind: "system", text: "没有可移除的第三方供应商" });
        env.tui.requestRender();
        return;
    }
    pickOne(env.tui, "移除供应商", removable.map((p) => ({ value: p.provider, label: p.displayName, description: p.provider })), async (route) => {
        try {
            const section = env.ctx.settings.get(settingsNamespace("llm-pi-ai"));
            const providers = { ...(section?.providers ?? {}) };
            delete providers[route];
            await env.ctx.settings.mutate(settingsNamespace("llm-pi-ai"), [{ op: "set", path: ["providers"], value: providers }]);
            env.transcript.append({ kind: "system", text: `已移除供应商 ${route}` });
        }
        catch (error) {
            env.transcript.append({ kind: "system", text: `移除失败: ${error instanceof Error ? error.message : String(error)}` });
        }
        env.tui.requestRender();
    });
}
//# sourceMappingURL=commands.js.map