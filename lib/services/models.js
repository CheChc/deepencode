/**
 * Merge registered providers with the configurable (possibly dormant)
 * directory — mirrors the web Models page's directory composition.
 */
export function listProviders(ctx) {
    const rows = [];
    const live = new Set();
    for (const p of ctx.llm.listProviders()) {
        live.add(p.id);
        rows.push({ provider: p.id, displayName: p.name, live: true });
    }
    for (const p of ctx.llm.listConfigurableProviders()) {
        if (live.has(p.provider))
            continue;
        rows.push({ provider: p.provider, displayName: p.displayName, live: false });
    }
    return rows;
}
/** List models for one provider (empty for dormant/unreachable routes). */
export async function listModels(ctx, provider) {
    try {
        const models = (await ctx.llm.listModels(provider));
        return models.map((m) => ({
            provider: m.provider,
            id: m.id,
            name: m.name,
            contextWindow: undefined,
        }));
    }
    catch {
        return [];
    }
}
/** Exact model metadata: context window + selectable reasoning efforts. */
export async function resolveModelMeta(ctx, provider, model) {
    try {
        const info = await ctx.llm.resolveModelInfo(provider, model);
        return {
            contextWindow: info.context?.contextWindow,
            reasoningEfforts: info.reasoning?.efforts.map((e) => ({ id: e.id, name: e.name })),
        };
    }
    catch {
        return {};
    }
}
/**
 * Apply a model choice to the live session (next step onward) and persist it
 * as the new-session default — exactly what the web selector does.
 * `selectionRef` is the mutable ref previously installed via
 * `installModelSelection` in the agent's setup.
 */
export async function applyModelChoice(ctx, selectionRef, choice, persist) {
    selectionRef.current = { ...choice };
    if (persist) {
        await ctx.agentDefaultModel.saveSelection({ ...choice });
    }
}
/** Current default selection (for the status bar and fresh sessions). */
export function currentDefault(ctx) {
    return ctx.agentDefaultModel.currentSelection();
}
//# sourceMappingURL=models.js.map