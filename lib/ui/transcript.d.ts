import { Container } from "@earendil-works/pi-tui";
import type { TranscriptItem } from "./transcript-model.js";
/**
 * Renders the conversation stream: user messages, streamed assistant markdown,
 * collapsed thinking rows, and tool-call/result lines.
 * The runner appends items as session events land; streaming assistant items
 * are updated in place so the scroll view follows the growing content.
 */
export declare class Transcript extends Container {
    private items;
    /** Child component per item, kept 1:1 with `items`. */
    private childrenList;
    append(item: TranscriptItem): void;
    /** Replace the last item in place (streaming text growth). */
    updateLast(item: TranscriptItem): void;
    clear(): void;
    get size(): number;
    private buildChild;
    private plainLines;
}
/** Helper used by the runner to clamp previews before they reach the UI. */
export declare function clampLine(text: string, width?: number): string;
//# sourceMappingURL=transcript.d.ts.map