import { Container, Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { theme, markdownTheme } from "./theme.js";
/**
 * Renders the conversation stream: welcome banner, user/assistant messages,
 * collapsed thinking rows, and tool-call/result lines — each with a coherent
 * opencode-style visual voice (role glyphs, mode-aware accents, black canvas).
 * The runner appends items as session events land; streaming assistant items
 * are updated in place so the scroll view follows the growing content.
 */
export class Transcript extends Container {
    items = [];
    /** Child component per item, kept 1:1 with `items`. */
    childrenList = [];
    append(item) {
        this.items.push(item);
        this.childrenList.push(this.buildChild(item));
        super.addChild(this.childrenList[this.childrenList.length - 1]);
    }
    /** Replace the last item in place (streaming text growth). */
    updateLast(item) {
        const last = this.items[this.items.length - 1];
        if (!last)
            return this.append(item);
        this.items[this.items.length - 1] = item;
        const child = this.childrenList[this.childrenList.length - 1];
        if (child instanceof Markdown && item.kind === "assistant") {
            child.setText(item.text);
        }
        else if (child instanceof Text) {
            child.setText(this.plainLines(item).join("\n"));
        }
    }
    clear() {
        for (const child of this.childrenList)
            super.removeChild(child);
        this.items = [];
        this.childrenList = [];
    }
    get size() {
        return this.items.length;
    }
    buildChild(item) {
        switch (item.kind) {
            case "assistant":
                return new Markdown(item.text, 0, 0, markdownTheme, {
                    // Keep the dark canvas consistent on terminals without OSC 11.
                    bgColor: (text) => chalk.bgBlack(text),
                });
            case "welcome":
                return new Text(item.lines.join("\n"), 0, 0, (text) => chalk.bgBlack(text));
            default:
                return new Text(this.plainLines(item).join("\n"), 0, 0, (text) => chalk.bgBlack(text));
        }
    }
    plainLines(item) {
        switch (item.kind) {
            case "user":
                return [`${chalk.hex("#58a6ff")("❯")} ${chalk.bold(item.text)}`];
            case "thinking": {
                const dur = item.durationMs ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : "";
                const preview = item.text.replace(/\s+/g, " ").slice(0, 90);
                return [theme.faint(`  ${chalk.hex("#58a6ff")("✦")} think · ${chalk.italic(preview)}${dur}`)];
            }
            case "tool-call": {
                const glyph = item.running ? chalk.hex("#58a6ff")("⠿") : chalk.hex("#58a6ff")("▸");
                return [`  ${glyph} ${chalk.hex("#58a6ff").bold(item.name)}${theme.faint(` ${item.argsPreview.slice(0, 70)}`)}`];
            }
            case "tool-result": {
                const glyph = item.ok ? theme.ok("✓") : theme.err("✖");
                return [`  ${glyph} ${theme.faint(`${item.name} · ${item.summary}`)}`];
            }
            case "system":
                return [theme.faint(`  ${item.text}`)];
            case "divider":
                return [theme.divider(`  ── ${item.text} ──`)];
            case "welcome":
                // Lines arrive pre-styled (brand + wordmark composition).
                return item.lines;
            case "assistant":
                return [item.text];
        }
    }
}
/** Helper used by the runner to clamp previews before they reach the UI. */
export function clampLine(text, width = 120) {
    return truncateToWidth(text.replace(/\s+/g, " "), width);
}
//# sourceMappingURL=transcript.js.map