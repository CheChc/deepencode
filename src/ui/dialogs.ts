import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component, Focusable, OverlayHandle, TUI } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { theme } from "./theme.js";

export interface PickItem {
  value: string;
  label: string;
  description?: string;
}

/**
 * Self-contained modal option menu: renders title/body/options and owns its
 * own keyboard handling, so it works regardless of overlay focus routing.
 */
class OptionMenu implements Component, Focusable {
  focused = false;
  private selectedIndex = 0;
  onSelect?: (value: string) => void;
  onCancel?: () => void;

  constructor(
    private readonly title: string,
    private readonly body: string,
    private readonly options: PickItem[],
  ) {}

  private current(): PickItem | undefined {
    return this.options[this.selectedIndex];
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) || matchesKey(data, Key.ctrl("p"))) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down) || matchesKey(data, Key.ctrl("n"))) {
      this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      const cur = this.current();
      if (cur) this.onSelect?.(cur.value);
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    const lines: string[] = [theme.accent(this.title)];
    for (const line of this.body.split("\n")) {
      lines.push(truncateToWidth(line, width));
    }
    lines.push("");
    this.options.forEach((opt, i) => {
      const prefix = i === this.selectedIndex ? `${theme.accent("→")} ` : "  ";
      const desc = opt.description ? theme.faint(`  ${opt.description}`) : "";
      lines.push(truncateToWidth(`${prefix}${opt.label}${desc}`, width));
    });
    lines.push("");
    lines.push(theme.faint("↑/↓ 选择 · Enter 确认 · Esc 取消"));
    return lines;
  }

  invalidate(): void {}
}

/**
 * Single-line free-text prompt with its own focus/key handling.
 */
class TextPrompt implements Component, Focusable {
  focused = false;
  private value: string;
  private cursor: number;
  onSubmit?: (text: string) => void;
  onCancel?: () => void;

  constructor(
    private readonly title: string,
    initial: string,
  ) {
    this.value = initial;
    this.cursor = initial.length;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.enter)) {
      this.onSubmit?.(this.value);
      return;
    }
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
      return;
    }
    if (matchesKey(data, Key.backspace)) {
      if (this.cursor > 0) {
        this.value = this.value.slice(0, this.cursor - 1) + this.value.slice(this.cursor);
        this.cursor -= 1;
      }
      return;
    }
    if (matchesKey(data, Key.delete)) {
      if (this.cursor < this.value.length) {
        this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + 1);
      }
      return;
    }
    if (matchesKey(data, Key.left)) {
      this.cursor = Math.max(0, this.cursor - 1);
      return;
    }
    if (matchesKey(data, Key.right)) {
      this.cursor = Math.min(this.value.length, this.cursor + 1);
      return;
    }
    if (matchesKey(data, Key.home) || matchesKey(data, Key.ctrl("a"))) {
      this.cursor = 0;
      return;
    }
    if (matchesKey(data, Key.end) || matchesKey(data, Key.ctrl("e"))) {
      this.cursor = this.value.length;
      return;
    }
    // Printable characters only; ignore escape sequences and control keys.
    if (typeof data === "string" && !data.startsWith("\x1b") && data >= " " && !data.startsWith("\x7f")) {
      const before = this.value.slice(0, this.cursor);
      const after = this.value.slice(this.cursor);
      this.value = before + data + after;
      this.cursor += data.length;
    }
  }

  render(width: number): string[] {
    const before = this.value.slice(0, this.cursor);
    const at = this.value.slice(this.cursor, this.cursor + 1) || " ";
    const after = this.value.slice(this.cursor + 1);
    const line = `${theme.accent("?")} ${before}${chalk.inverse(at)}${after}`;
    return [
      theme.accent(this.title),
      "",
      truncateToWidth(line, width),
      "",
      theme.faint("Enter 确认 · Esc 取消"),
    ];
  }

  invalidate(): void {}
}

/** Modal single-choice picker (models, presets, providers…). */
export function pickOne(
  tui: TUI,
  title: string,
  items: PickItem[],
  onPick: (value: string) => void,
  onCancel?: () => void,
): OverlayHandle {
  const menu = new OptionMenu(title, "", items);
  const handle = tui.showOverlay(menu, { maxHeight: "80%", minWidth: 30, width: "70%" });
  menu.onSelect = (value) => {
    handle.hide();
    onPick(value);
  };
  menu.onCancel = () => {
    handle.hide();
    onCancel?.();
  };
  return handle;
}

/** Modal option picker for approvals and questions. */
export function pickOption(
  tui: TUI,
  title: string,
  body: string,
  options: PickItem[],
  onPick: (value: string) => void,
  onCancel?: () => void,
): OverlayHandle {
  const menu = new OptionMenu(title, body, options);
  const handle = tui.showOverlay(menu, { maxHeight: "80%", minWidth: 36, width: "60%" });
  menu.onSelect = (value) => {
    handle.hide();
    onPick(value);
  };
  menu.onCancel = () => {
    handle.hide();
    onCancel?.();
  };
  return handle;
}

/** Modal single-line free-text prompt (provider fields, "Other…" answers). */
export function promptText(
  tui: TUI,
  title: string,
  initial: string,
  onSubmit: (text: string) => void,
  onCancel?: () => void,
): OverlayHandle {
  const prompt = new TextPrompt(title, initial);
  const handle = tui.showOverlay(prompt, { minWidth: 40, width: "60%", maxHeight: 6 });
  prompt.onSubmit = (value) => {
    handle.hide();
    onSubmit(value);
  };
  prompt.onCancel = () => {
    handle.hide();
    onCancel?.();
  };
  return handle;
}
