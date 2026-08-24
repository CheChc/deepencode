import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
function fmtCount(n) {
    if (n >= 1_000_000)
        return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000)
        return (n / 1_000).toFixed(1) + "K";
    return String(Math.round(n));
}
function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0)
        return `${h}h${String(m).padStart(2, "0")}m`;
    if (m > 0)
        return `${m}m${String(s).padStart(2, "0")}s`;
    return `${s}s`;
}
/** Color the context fill by Hermes thresholds. */
function contextColor(pct) {
    if (pct >= 95)
        return chalk.bgRed.black;
    if (pct >= 80)
        return chalk.bgYellow.black;
    if (pct >= 50)
        return chalk.bgYellow.black;
    return chalk.bgGreen.black;
}
function contextBar(used, max, width) {
    const barWidth = Math.max(6, Math.min(20, width - 8));
    const ratio = max && max > 0 ? Math.min(1, used / max) : 0;
    const filled = Math.round(ratio * barWidth);
    const pct = Math.round(ratio * 100);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const color = contextColor(pct);
    return `${fmtCount(used)}${max ? "/" + fmtCount(max) : ""} ${color(` ${bar} `)} ${String(pct).padStart(3)}%`;
}
/**
 * Single-line live status bar, Hermes-inspired:
 * `<glyph> <model> │ <MODE> <preset> <perm> │ ♻ 89% │ 12.4K/200K [████░░] 6% │ $0.06 │ 15m`
 * Degrades gracefully on narrow terminals (drops cost, then cache, then bar).
 */
export class StatusBar {
    snap;
    cachedWidth;
    cachedLines;
    constructor(initial) {
        this.snap = initial;
    }
    update(snap) {
        this.snap = snap;
        this.invalidate();
    }
    segments(width) {
        const s = this.snap;
        const glyph = s.running ? chalk.cyan("✦") : s.yolo ? chalk.red("⚠") : "⚕";
        // Hermes truncates long model names; the official provider shows the bare
        // model id while third-party routes keep the provider prefix for context.
        const modelFull = s.provider === "deepseek-official" ? s.model : `${s.provider}/${s.model}`;
        const model = truncateToWidth(modelFull, 26, "");
        const mode = s.mode === "plan" ? chalk.bgCyan.black(" PLAN ") : chalk.bgBlue.black(" BUILD ");
        const perm = {
            "read-only": chalk.gray("ro"),
            "workspace-write": chalk.green("ws"),
            "danger-full-access": chalk.red("da"),
            custom: chalk.magenta("cu"),
        };
        const permText = perm[s.permission] ?? chalk.gray(s.permission);
        const preset = s.preset ? chalk.dim(`· ${s.preset}`) : "";
        const cache = s.cacheHit !== undefined ? `${chalk.green("♻")} ${Math.round(s.cacheHit * 100)}%` : undefined;
        const context = contextBar(s.context.used, s.context.max, 24);
        const cost = s.costUsd !== undefined && s.costUsd > 0 ? `$${s.costUsd.toFixed(2)}` : undefined;
        const compact = s.compactions ? `${chalk.dim(`🗜️ ${s.compactions}`)}` : undefined;
        const dur = fmtDuration(s.elapsedSec);
        const left = `${glyph} ${chalk.bold(model)} │ ${mode} ${permText}${preset}`;
        let segs = [left];
        if (cache)
            segs.push(cache);
        segs.push(context);
        if (cost)
            segs.push(cost);
        if (compact)
            segs.push(compact);
        segs.push(dur);
        // Degrade by dropping the least essential segments while over width.
        while (segs.length > 2 && visibleWidth(segs.join(" │ ")) > width) {
            const idx = segs.findIndex((x) => x === cost);
            if (idx >= 0) {
                segs.splice(idx, 1);
                continue;
            }
            const ci = segs.findIndex((x) => x === compact);
            if (ci >= 0) {
                segs.splice(ci, 1);
                continue;
            }
            const pi = segs.findIndex((x) => x === preset || x.startsWith(chalk.dim("·")));
            if (pi >= 0) {
                segs.splice(pi, 1);
                continue;
            }
            const gi = segs.findIndex((x) => x === cache);
            if (gi >= 0) {
                segs.splice(gi, 1);
                continue;
            }
            break;
        }
        return segs;
    }
    render(width) {
        if (this.cachedLines && this.cachedWidth === width)
            return this.cachedLines;
        const line = truncateToWidth(this.segments(width).join(" │ "), width);
        this.cachedWidth = width;
        this.cachedLines = [line];
        return this.cachedLines;
    }
    invalidate() {
        this.cachedWidth = undefined;
        this.cachedLines = undefined;
    }
}
//# sourceMappingURL=status-bar.js.map