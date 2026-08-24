import { Key, matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { theme } from "./theme.js";
/**
 * Self-contained modal option menu: renders title/body/options and owns its
 * own keyboard handling, so it works regardless of overlay focus routing.
 */
class OptionMenu {
    title;
    body;
    options;
    focused = false;
    selectedIndex = 0;
    onSelect;
    onCancel;
    constructor(title, body, options) {
        this.title = title;
        this.body = body;
        this.options = options;
    }
    current() {
        return this.options[this.selectedIndex];
    }
    handleInput(data) {
        if (matchesKey(data, Key.up) || matchesKey(data, Key.ctrl("p"))) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        }
        else if (matchesKey(data, Key.down) || matchesKey(data, Key.ctrl("n"))) {
            this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
        }
        else if (matchesKey(data, Key.enter)) {
            const cur = this.current();
            if (cur)
                this.onSelect?.(cur.value);
        }
        else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
            this.onCancel?.();
        }
    }
    render(width) {
        const pad = (line) => chalk.bgBlack(truncateToWidth(line, width) + " ".repeat(Math.max(0, width - visibleWidth(line))));
        const lines = [pad(theme.accent(this.title))];
        for (const line of this.body.split("\n")) {
            lines.push(pad(line));
        }
        lines.push(pad(""));
        this.options.forEach((opt, i) => {
            const prefix = i === this.selectedIndex ? `${theme.accent("→")} ` : "  ";
            const desc = opt.description ? theme.faint(`  ${opt.description}`) : "";
            lines.push(truncateToWidth(`${prefix}${opt.label}${desc}`, width));
        });
        lines.push("");
        lines.push(theme.faint("↑/↓ 选择 · Enter 确认 · Esc 取消"));
        return lines;
    }
    invalidate() { }
}
/**
 * Single-line free-text prompt with its own focus/key handling.
 */
class TextPrompt {
    title;
    focused = false;
    value;
    cursor;
    onSubmit;
    onCancel;
    constructor(title, initial) {
        this.title = title;
        this.value = initial;
        this.cursor = initial.length;
    }
    handleInput(data) {
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
    render(width) {
        const before = this.value.slice(0, this.cursor);
        const at = this.value.slice(this.cursor, this.cursor + 1) || " ";
        const after = this.value.slice(this.cursor + 1);
        const line = `${theme.accent("?")} ${before}${chalk.inverse(at)}${after}`;
        const pad = (s) => chalk.bgBlack(truncateToWidth(s, width) + " ".repeat(Math.max(0, width - visibleWidth(s))));
        return [
            pad(theme.accent(this.title)),
            pad(""),
            pad(line),
            pad(""),
            pad(theme.faint("Enter 确认 · Esc 取消")),
        ];
    }
    invalidate() { }
}
/** Modal single-choice picker (models, presets, providers…). */
export function pickOne(tui, title, items, onPick, onCancel) {
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
export function pickOption(tui, title, body, options, onPick, onCancel) {
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
export function promptText(tui, title, initial, onSubmit, onCancel) {
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
//# sourceMappingURL=dialogs.js.map