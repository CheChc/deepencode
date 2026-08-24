/** Normalized transcript model the UI renders; the runner maps DSH session events onto these items. */
export type TranscriptItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; streaming?: boolean }
  | { kind: "thinking"; text: string; streaming?: boolean; durationMs?: number }
  | { kind: "tool-call"; id: string; name: string; argsPreview: string; running?: boolean }
  | { kind: "tool-result"; id: string; name: string; ok: boolean; summary: string }
  | { kind: "system"; text: string }
  | { kind: "divider"; text: string }
  | { kind: "welcome"; lines: string[] };

/** Derives a compact one-line display for an item (used by transcript + pickers). */
export function summarizeItem(item: TranscriptItem): string {
  switch (item.kind) {
    case "user":
      return item.text.slice(0, 80).replace(/\s+/g, " ");
    case "assistant":
      return item.text.slice(0, 80).replace(/\s+/g, " ");
    case "thinking":
      return item.text.slice(0, 80).replace(/\s+/g, " ");
    case "tool-call":
      return `${item.name}(${item.argsPreview.slice(0, 60)})`;
    case "tool-result":
      return item.summary.slice(0, 80);
    case "system":
    case "divider":
      return item.text;
    case "welcome":
      return item.lines[0] ?? "";
  }
}
