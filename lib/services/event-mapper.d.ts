import type { SessionEvent } from "@deepseek-ai/dsh-session";
import type { TranscriptItem } from "../ui/transcript-model.js";
/** Tool-call args preview: compact the raw JSON string for one-line display. */
export declare function argsPreview(argumentsRaw: string, max?: number): string;
/** Result summary: first non-empty text of a tool-result message's blocks. */
export declare function resultSummary(message: unknown, max?: number): string;
/** Tool-call id of a tool-result message (lives inside its tool-result block). */
export declare function toolResultCallId(message: unknown): string;
export declare function assistantText(message: unknown): string;
export declare function reasoningText(message: unknown): string;
export interface MapperState {
    /** Live assistant item currently streaming (index into the transcript). */
    assistant?: {
        index: number;
        text: string;
    };
    /** Live thinking item currently streaming. */
    thinking?: {
        index: number;
        text: string;
        startedAt: number;
    };
    /** Open tool calls by callId → transcript index. */
    tools: Map<string, {
        index: number;
        name: string;
    }>;
}
export type TranscriptOp = {
    op: "append";
    item: TranscriptItem;
    stream?: "assistant" | "thinking";
} | {
    op: "update";
    index: number;
    item: TranscriptItem;
} | {
    op: "system";
    text: string;
} | {
    op: "divider";
    text: string;
};
/**
 * Maps one raw session event onto transcript operations. The runner owns the
 * transcript + state and applies ops in order.
 */
export declare function mapEvent(event: SessionEvent, state: MapperState, live: number): TranscriptOp[];
//# sourceMappingURL=event-mapper.d.ts.map