/** Normalized transcript model the UI renders; the runner maps DSH session events onto these items. */
export type TranscriptItem = {
    kind: "user";
    text: string;
} | {
    kind: "assistant";
    text: string;
    streaming?: boolean;
} | {
    kind: "thinking";
    text: string;
    streaming?: boolean;
    durationMs?: number;
} | {
    kind: "tool-call";
    id: string;
    name: string;
    argsPreview: string;
    running?: boolean;
} | {
    kind: "tool-result";
    id: string;
    name: string;
    ok: boolean;
    summary: string;
} | {
    kind: "system";
    text: string;
} | {
    kind: "divider";
    text: string;
} | {
    kind: "welcome";
    lines: string[];
};
/** Derives a compact one-line display for an item (used by transcript + pickers). */
export declare function summarizeItem(item: TranscriptItem): string;
//# sourceMappingURL=transcript-model.d.ts.map