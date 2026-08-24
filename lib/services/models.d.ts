import type { Context } from "@deepseek-ai/cordis";
import type { ModelSelection } from "@deepseek-ai/dsh-agent";
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
    reasoningEfforts?: Array<{
        id: string;
        name: string;
    }>;
}
/** A complete user choice: provider + model + optional effort. */
export type ModelChoice = ModelSelection;
/**
 * Merge registered providers with the configurable (possibly dormant)
 * directory — mirrors the web Models page's directory composition.
 */
export declare function listProviders(ctx: Context): ProviderRow[];
/** List models for one provider (empty for dormant/unreachable routes). */
export declare function listModels(ctx: Context, provider: string): Promise<ModelRow[]>;
/** Exact model metadata: context window + selectable reasoning efforts. */
export declare function resolveModelMeta(ctx: Context, provider: string, model: string): Promise<{
    contextWindow?: number;
    reasoningEfforts?: Array<{
        id: string;
        name: string;
    }>;
}>;
/**
 * Apply a model choice to the live session (next step onward) and persist it
 * as the new-session default — exactly what the web selector does.
 * `selectionRef` is the mutable ref previously installed via
 * `installModelSelection` in the agent's setup.
 */
export declare function applyModelChoice(ctx: Context, selectionRef: {
    current: ModelSelection | undefined;
    assembled: ModelSelection | undefined;
}, choice: ModelChoice, persist: boolean): Promise<void>;
/** Current default selection (for the status bar and fresh sessions). */
export declare function currentDefault(ctx: Context): ModelSelection;
//# sourceMappingURL=models.d.ts.map