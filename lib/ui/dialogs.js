import { Key, matchesKey, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { dialogBorders } from "./theme.js";
/** Full-width black pad; used for every bounded line so dialogs read as one canvas. */
function padLine(line, width) {
    return chalk.bgBlack(line + " ".repeat(Math.max(0, width - visibleWidth(line))));
}
/** Renders a line inside an ASCII box: `│ ` + content padded + `│`. */
function boxLine(content, innerWidth, border) {
    return border(`│ `) + content + " ".repeat(Math.max(0, innerWidth - visibleWidth(content))) + ` ${border("│")}`;
}
function buildBox(lines, width, tone) {
    const palette = dialogBorders[tone];
    const border = palette.border;
    const innerWidth = Math.max(8, width - 6);
    const out = [];
    const title = lines[0]?.content ?? "";
    const titlePlain = title.replace(/\x1b\[[0-9;]*m/g, "");
    const titleVisible = visibleWidth(titlePlain);
    const topPad = Math.max(1, width - titleVisible - 6);
    out.push(padLine(border(`┌─ `) + title + " ".repeat(topPad) + border("─┐"), width));
    for (const line of lines.slice(1)) {
        out.push(padLine(boxLine(line.content, innerWidth, border), width));
    }
    out.push(padLine(border(`└─`) + "─".repeat(innerWidth + 1) + border("─┘"), width));
    return out;
}
/**
 * Self-contained modal option menu: a bordered dialog that owns its keyboard
 * handling, so it works regardless of overlay focus routing.
 */
class OptionMenu {
    title;
    body;
    options;
    tone;
    focused = false;
    selectedIndex = 0;
    onSelect;
    onCancel;
    constructor(title, body, options, tone = "blue") {
        this.title = title;
        this.body = body;
        this.options = options;
        this.tone = tone;
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
        const palette = dialogBorders[this.tone];
        const accent = palette.accent;
        const bodyLines = this.body === "" ? [] : this.body.split("\n");
        const optionLines = this.options.map((opt, i) => {
            const selected = i === this.selectedIndex;
            const prefix = selected ? chalk.hex("#58a6ff")("▸ ") : "   ";
            const label = selected ? chalk.bgHex("#1e3a5f").white(opt.label) : chalk.white(opt.label);
            const desc = opt.description && !selected ? chalk.gray(`  ${opt.description}`) : "";
            return `${prefix}${label}${desc}`;
        });
        const lines = [
            { content: accent(` ${this.title} `) },
        ];
        for (const l of bodyLines)
            lines.push({ content: whiteIfEmpty(l) });
        if (bodyLines.length > 0)
            lines.push({ content: "" });
        for (const l of optionLines)
            lines.push({ content: l });
        lines.push({ content: "" });
        lines.push({ content: chalk.gray("↑/↓ 选择 · Enter 确认 · Esc 取消") });
        return buildBox(lines.map((l) => ({ content: l.content })), width, this.tone);
    }
    invalidate() { }
}
function whiteIfEmpty(s) {
    return s === "" ? " " : s;
}
/**
 * Single-line free-text prompt with its own focus/key handling, same boxed
 * visual language as the option menu.
 */
class TextPrompt {
    title;
    initial;
    tone;
    focused = false;
    value;
    cursor;
    onSubmit;
    onCancel;
    constructor(title, initial, tone = "blue") {
        this.title = title;
        this.initial = initial;
        this.tone = tone;
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
        if (typeof data === "string" && !data.startsWith("\x1b") && data >= " " && !data.startsWith("\x7f")) {
            const before = this.value.slice(0, this.cursor);
            const after = this.value.slice(this.cursor);
            this.value = before + data + after;
            this.cursor += data.length;
        }
    }
    render(width) {
        const palette = dialogBorders[this.tone];
        const before = this.value.slice(0, this.cursor);
        const at = this.value.slice(this.cursor, this.cursor + 1) || " ";
        const after = this.value.slice(this.cursor + 1);
        const line = ` ${before}${chalk.bgHex("#2563eb").white(at)}${after}`;
        const lines = [
            { content: palette.accent(` ${this.title} `) },
            { content: "" },
            { content: line },
            { content: "" },
            { content: chalk.gray("Enter 确认 · Esc 取消") },
        ];
        return buildBox(lines, width, this.tone);
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
/** Modal option picker for approvals and questions (tone: orange for caution). */
export function pickOption(tui, title, body, options, onPick, onCancel, tone = "blue") {
    const menu = new OptionMenu(title, body, options, tone);
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