/** Derives a compact one-line display for an item (used by transcript + pickers). */
export function summarizeItem(item) {
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
//# sourceMappingURL=transcript-model.js.map