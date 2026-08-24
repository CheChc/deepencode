import type { Context } from "@deepseek-ai/cordis";
import type { ModelSelection } from "@deepseek-ai/dsh-agent";
import type { LlmModelInfo, LlmProviderInfo, LlmConfigurableProvider } from "@deepseek-ai/dsh-llm";
// Module augmentation: ctx.agentDefaultModel
import type {} from "@deepseek-ai/dsh-agent-default-model";

/** One provider row for the /model picker. */
export interface ProviderRow {
  provider: string;
  displayName: string;
  /** Live (registered, has models) vs dormant (configurable, no route yet). */
  live: boolean;
}

/** One model row for the /model picker. */
export interface ModelRow {
  provider: string;
  id: string;
  name: string;
  contextWindow?: number;
  reasoningEfforts?: Array<{ id: string; name: string }>;
}

/** A complete user choice: provider + model + optional effort. */
export type ModelChoice = ModelSelection;

/**
 * Merge registered providers with the configurable (possibly dormant)
 * directory — mirrors the web Models page's directory composition.
 */
export function listProviders(ctx: Context): ProviderRow[] {
  const rows: ProviderRow[] = [];
  const live = new Set<string>();
  for (const p of ctx.llm.listProviders() as LlmProviderInfo[]) {
    live.add(p.id);
    rows.push({ provider: p.id, displayName: p.name, live: true });
  }
  for (const p of ctx.llm.listConfigurableProviders() as LlmConfigurableProvider[]) {
    if (live.has(p.provider)) continue;
    rows.push({ provider: p.provider, displayName: p.displayName, live: false });
  }
  return rows;
}

/** List models for one provider (empty for dormant/unreachable routes). */
export async function listModels(ctx: Context, provider: string): Promise<ModelRow[]> {
  try {
    const models = (await ctx.llm.listModels(provider)) as LlmModelInfo[];
    return models.map((m) => ({
      provider: m.provider,
      id: m.id,
      name: m.name,
      contextWindow: undefined,
    }));
  } catch {
    return [];
  }
}

/** Exact model metadata: context window + selectable reasoning efforts. */
export async function resolveModelMeta(
  ctx: Context,
  provider: string,
  model: string,
): Promise<{ contextWindow?: number; reasoningEfforts?: Array<{ id: string; name: string }> }> {
  try {
    const info = await ctx.llm.resolveModelInfo(provider, model);
    return {
      contextWindow: info.context?.contextWindow,
      reasoningEfforts: info.reasoning?.efforts.map((e) => ({ id: e.id, name: e.name })),
    };
  } catch {
    return {};
  }
}

/**
 * Apply a model choice to the live session (next step onward) and persist it
 * as the new-session default — exactly what the web selector does.
 * `selectionRef` is the mutable ref previously installed via
 * `installModelSelection` in the agent's setup.
 */
export async function applyModelChoice(
  ctx: Context,
  selectionRef: { current: ModelSelection | undefined; assembled: ModelSelection | undefined },
  choice: ModelChoice,
  persist: boolean,
): Promise<void> {
  selectionRef.current = { ...choice };
  if (persist) {
    await ctx.agentDefaultModel.saveSelection({ ...choice });
  }
}

/** Current default selection (for the status bar and fresh sessions). */
export function currentDefault(ctx: Context): ModelSelection {
  return ctx.agentDefaultModel.currentSelection();
}
