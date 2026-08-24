import type { Component } from "@earendil-works/pi-tui";
/** Snapshot feeding the Hermes-style status bar. */
export interface StatusSnapshot {
    /** Current model id, e.g. `deepseek-v4-pro`. */
    model: string;
    /** provider id */
    provider: string;
    /** Session mode: build | plan */
    mode: "build" | "plan";
    /** Agent preset id (standard/code/minimal/...) */
    preset?: string;
    /** Permission preset id: read-only | workspace-write | danger-full-access | custom */
    permission: string;
    /** Context window usage. */
    context: {
        used: number;
        max?: number;
    };
    /** Prompt cache hit ratio in [0,1]; undefined hides the segment. */
    cacheHit?: number;
    /** Estimated session cost in USD; undefined hides the segment. */
    costUsd?: number;
    /** Session elapsed seconds. */
    elapsedSec: number;
    /** Turn / step counters for this session. */
    turns?: number;
    steps?: number;
    /** Number of context compactions so far (hidden while 0). */
    compactions?: number;
    /** True while a turn is running (shows a live glyph). */
    running?: boolean;
    /** Spinner frame counter advanced while running. */
    spinnerFrame?: number;
    /** True in automatic-approval mode (danger-full-access). */
    yolo?: boolean;
}
/**
 * Single-line live status bar, Hermes-inspired:
 * `<glyph> <model> │ <MODE> <preset> <perm> │ ♻ 89% │ 12.4K/200K [████░░] 6% │ $0.06 │ 15m`
 * Degrades gracefully on narrow terminals (drops cost, then cache, then bar).
 */
export declare class StatusBar implements Component {
    private snap;
    private cachedWidth?;
    private cachedLines?;
    constructor(initial: StatusSnapshot);
    update(snap: StatusSnapshot): void;
    private segments;
    render(width: number): string[];
    invalidate(): void;
}
//# sourceMappingURL=status-bar.d.ts.map