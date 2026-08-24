import { Container, Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { theme, markdownTheme } from "./theme.js";
import type { TranscriptItem } from "./transcript-model.js";

/**
 * Renders the conversation stream: user messages, streamed assistant markdown,
 * collapsed thinking rows, and tool-call/result lines.
 * The runner appends items as session events land; streaming assistant items
 * are updated in place so the scroll view follows the growing content.
 */
export class Transcript extends Container {
  private items: TranscriptItem[] = [];
  /** Child component per item, kept 1:1 with `items`. */
  private childrenList: (Text | Markdown)[] = [];

  append(item: TranscriptItem): void {
    this.items.push(item);
    this.childrenList.push(this.buildChild(item));
    super.addChild(this.childrenList[this.childrenList.length - 1]);
  }

  /** Replace the last item in place (streaming text growth). */
  updateLast(item: TranscriptItem): void {
    const last = this.items[this.items.length - 1];
    if (!last) return this.append(item);
    this.items[this.items.length - 1] = item;
    const child = this.childrenList[this.childrenList.length - 1];
    if (child instanceof Markdown && item.kind === "assistant") {
      child.setText(item.text);
    } else if (child instanceof Text) {
      child.setText(this.plainLines(item).join("\n"));
    }
  }

  clear(): void {
    for (const child of this.childrenList) super.removeChild(child);
    this.items = [];
    this.childrenList = [];
  }

  get size(): number {
    return this.items.length;
  }

  private buildChild(item: TranscriptItem): Text | Markdown {
    switch (item.kind) {
      case "assistant":
        return new Markdown(item.text, 0, 0, markdownTheme);
      default:
        return new Text(this.plainLines(item).join("\n"), 0, 0);
    }
  }

  private plainLines(item: TranscriptItem): string[] {
    switch (item.kind) {
      case "user":
        return [`${theme.user("❯")} ${item.text}`];
      case "thinking": {
        const dur = item.durationMs ? ` · ${(item.durationMs / 1000).toFixed(1)}s` : "";
        const preview = item.text.replace(/\s+/g, " ").slice(0, 90);
        return [theme.faint(`${theme.info("✦")} think · ${preview}${dur}`)];
      }
      case "tool-call": {
        const glyph = item.running ? theme.info("✦") : theme.faint("·");
        return [theme.info(`${glyph} ${item.name}`) + theme.faint(` ${item.argsPreview.slice(0, 80)}`)];
      }
      case "tool-result": {
        const glyph = item.ok ? theme.ok("✓") : theme.err("✖");
        return [theme.faint(`${glyph} ${item.name} · ${item.summary}`)];
      }
      case "system":
        return [theme.faint(item.text)];
      case "divider":
        return [theme.divider(`── ${item.text} ──`)];
      case "assistant":
        return [item.text];
    }
  }
}

/** Helper used by the runner to clamp previews before they reach the UI. */
export function clampLine(text: string, width = 120): string {
  return truncateToWidth(text.replace(/\s+/g, " "), width);
}
