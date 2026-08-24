import type { TUI } from "@earendil-works/pi-tui";
import type { Context } from "@deepseek-ai/cordis";
import type { SessionController } from "./services/session-view.js";
import { listModels, listProviders, resolveModelMeta } from "./services/models.js";
import { pickOne, pickOption, promptText } from "./ui/dialogs.js";
import { theme } from "./ui/theme.js";
import type { Transcript } from "./ui/transcript.js";

// Module augmentations: ctx.sessionQuery / ctx.settings / ctx.agentDefaultModel
import type {} from "@deepseek-ai/dsh-session-query";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import type {} from "@deepseek-ai/dsh-settings";
import type {} from "@deepseek-ai/dsh-agent-default-model";
import type { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import type { ModelSelection } from "@deepseek-ai/dsh-agent";

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

export const COMMANDS: CommandSpec[] = [
  {
    name: "help",
    description: "列出全部斜杠命令",
    run(env) {
      const lines = COMMANDS.map((c) => theme.accent(`/${c.name}`) + theme.faint(` — ${c.description}`));
      env.transcript.append({ kind: "system", text: lines.join("\n") });
      env.tui.requestRender();
    },
  },
  {
    name: "plan",
    description: "进入 plan 模式(off 退出;带文字则进入并提交)",
    run(env, args) {
      const trimmed = args.trim();
      // 静默切换:状态栏徽章与编辑器边框即反馈,不刷转录日志。
      if (trimmed === "off") {
        void env.controller.setPlan(false);
      } else {
        void env.controller.setPlan(true, trimmed === "" ? undefined : trimmed);
      }
      env.tui.requestRender();
    },
  },
  {
    name: "model",
    description: "选择供应商 / 模型 / 思考强度",
    async run(env) {
      const providers = listProviders(env.ctx);
      if (providers.length === 0) {
        env.transcript.append({ kind: "system", text: "没有可用模型供应商" });
        env.tui.requestRender();
        return;
      }
      pickOne(
        env.tui,
        "选择供应商",
        providers.map((p) => ({ value: p.provider, label: p.live ? p.displayName : `${p.displayName} (未配置)`, description: p.provider })),
        (provider) => void pickModel(env, provider),
      );
    },
  },
  {
    name: "effort",
    description: "切换当前模型的思考强度(不换模型)",
    async run(env) {
      const sel = env.controller.selection;
      if (!sel) return;
      const meta = await resolveModelMeta(env.ctx, sel.provider, sel.model);
      const efforts = meta.reasoningEfforts ?? [];
      if (efforts.length === 0) {
        env.transcript.append({ kind: "system", text: "当前模型不支持选择思考强度" });
        env.tui.requestRender();
        return;
      }
      pickOne(
        env.tui,
        `思考强度 · ${sel.model}`,
        [
          { value: "", label: "默认", description: sel.reasoningEffort ? undefined : "· 当前" },
          ...efforts.map((e) => ({ value: e.id, label: e.name, description: sel.reasoningEffort === e.id ? "· 当前" : undefined })),
        ],
        (effort) => {
          // 静默生效:状态栏模型段的强度后缀即反馈。
          const choice: ModelSelection = { ...sel, reasoningEffort: effort === "" ? undefined : (effort as ReasoningEffortId) };
          env.controller.setSelection(choice);
          void applyDefault(env, choice);
          env.tui.requestRender();
        },
      );
    },
  },
  {
    name: "provider",
    description: "管理第三方供应商:add 添加 / rm 移除",
    async run(env, args) {
      const [sub, ...rest] = args.trim().split(/\s+/);
      if (sub === "add") {
        void addProviderFlow(env);
      } else if (sub === "rm" || sub === "remove") {
        void removeProviderFlow(env);
      } else {
        env.transcript.append({ kind: "system", text: "用法: /provider add | /provider rm" });
        env.tui.requestRender();
      }
    },
  },
  {
    name: "permissions",
    description: "切换权限预设:read-only / workspace-write / danger-full-access",
    run(env, args) {
      const names = ["read-only", "workspace-write", "danger-full-access"];
      const target = args.trim();
      if (names.includes(target)) {
        // 静默切换:状态栏权限徽章即反馈。
        env.controller.setPermission(target);
        env.tui.requestRender();
        return;
      }
      pickOption(
        env.tui,
        "切换权限预设",
        `当前:${env.controller.currentPermission()}`,
        names.map((n) => ({ value: n, label: n })),
        (value) => {
          env.controller.setPermission(value);
          env.tui.requestRender();
        },
      );
    },
  },
  {
    name: "sessions",
    description: "列出持久会话并恢复",
    async run(env) {
      let records: Array<{ id: string; title?: string; updatedAt?: number }> = [];
      try {
        records = (await env.ctx.sessionQuery.listSessions()) as never;
      } catch {
        /* listing unavailable */
      }
      if (records.length === 0) {
        env.transcript.append({ kind: "system", text: "没有可恢复的会话" });
        env.tui.requestRender();
        return;
      }
      pickOne(
        env.tui,
        "恢复会话(将替换当前会话)",
        records.map((r) => ({
          value: r.id,
          label: r.title ?? r.id,
          description: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : undefined,
        })),
        (_value) => {
          env.transcript.append({ kind: "system", text: "会话切换将在退出后生效 —— v1 请用 dsh --profile tui --resume <id> 恢复" });
          env.tui.requestRender();
        },
      );
    },
  },
  {
    name: "status",
    description: "显示会话信息(模型/模式/权限/轮次)",
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
    description: "退出 TUI",
    run(env) {
      env.quit(0);
    },
  },
];

async function pickModel(env: CommandEnv, provider: string): Promise<void> {
  const models = await listModels(env.ctx, provider);
  if (models.length === 0) {
    env.transcript.append({ kind: "system", text: `供应商 ${provider} 没有可用模型` });
    env.tui.requestRender();
    return;
  }
  pickOne(
    env.tui,
    `选择模型 · ${provider}`,
    models.map((m) => ({ value: `${provider}\u0000${m.id}`, label: m.name, description: m.id })),
    async (value) => {
      const model = value.split("\u0000")[1];
      const meta = await resolveModelMeta(env.ctx, provider, model);
      const efforts = meta.reasoningEfforts ?? [];
      const pickEffort = () =>
        pickOne(
          env.tui,
          `推理强度 · ${model}`,
          [{ value: "", label: "默认", description: env.controller.selection?.reasoningEffort ? undefined : "· 当前" },
           ...efforts.map((e) => ({ value: e.id, label: e.name, description: env.controller.selection?.reasoningEffort === e.id ? "· 当前" : undefined }))],
          (effort) => {
            const choice: ModelSelection = { provider, model, reasoningEffort: effort === "" ? undefined : (effort as ReasoningEffortId) };
            // 静默生效:状态栏模型段即反馈。
            env.controller.setSelection(choice);
            void applyDefault(env, choice);
            env.tui.requestRender();
          },
        );
      if (efforts.length === 0) {
        const choice: ModelSelection = { provider, model };
        env.controller.setSelection(choice);
        void applyDefault(env, choice);
        env.tui.requestRender();
      } else {
        pickEffort();
      }
    },
  );
}

async function applyDefault(env: CommandEnv, choice: ModelSelection): Promise<void> {
  try {
    await env.ctx.agentDefaultModel.saveSelection({ ...choice });
  } catch {
    /* persistence optional */
  }
}

async function addProviderFlow(env: CommandEnv): Promise<void> {
  promptText(env.tui, "新供应商 ID(如 openai 或 my-gateway)", "", (route) => {
    promptText(env.tui, "接口地址 baseURL(如 https://api.openai.com/v1)", "", (baseURL) => {
      promptText(env.tui, "API Key 环境变量名(如 OPENAI_API_KEY)", "OPENAI_API_KEY", (apiKeyEnv) => {
        promptText(env.tui, "模型列表,逗号分隔(如 gpt-4o,gpt-4o-mini;已知供应商可留空)", "", async (modelsRaw) => {
          try {
            const section = env.ctx.settings.get(settingsNamespace("llm-pi-ai")) as { providers?: Record<string, unknown> } | undefined;
            const providers = { ...(section?.providers ?? {}) };
            const entry: Record<string, unknown> = { apiKeyEnv, baseURL };
            // Unknown routes must declare the wire protocol; OpenAI-compatible
            // endpoints are the common case. Known catalog routes infer it.
            const known = listProviders(env.ctx).some((p) => p.provider === route && p.live);
            if (!known) entry.api = "openai-completions";
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
          } catch (error) {
            env.transcript.append({ kind: "system", text: `添加失败: ${error instanceof Error ? error.message : String(error)}` });
            env.tui.requestRender();
          }
        });
      });
    });
  });
}

async function removeProviderFlow(env: CommandEnv): Promise<void> {
  const providers = listProviders(env.ctx);
  // Only live, user-configured routes are removable — the dormant directory
  // entries (openai/anthropic/…) are the adapter's known-route catalog.
  const removable = providers.filter((p) => p.provider !== "deepseek-official" && p.live);
  if (removable.length === 0) {
    env.transcript.append({ kind: "system", text: "没有可移除的第三方供应商" });
    env.tui.requestRender();
    return;
  }
  pickOne(
    env.tui,
    "移除供应商",
    removable.map((p) => ({ value: p.provider, label: p.displayName, description: p.provider })),
    async (route) => {
      try {
        const section = env.ctx.settings.get(settingsNamespace("llm-pi-ai")) as { providers?: Record<string, unknown> } | undefined;
        const providers = { ...(section?.providers ?? {}) };
        delete providers[route];
        await env.ctx.settings.mutate(settingsNamespace("llm-pi-ai"), [{ op: "set", path: ["providers"], value: providers }]);
        env.transcript.append({ kind: "system", text: `已移除供应商 ${route}` });
      } catch (error) {
        env.transcript.append({ kind: "system", text: `移除失败: ${error instanceof Error ? error.message : String(error)}` });
      }
      env.tui.requestRender();
    },
  );
}
