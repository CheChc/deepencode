import chalk from "chalk";
/** Central color/typography palette for the whole terminal surface. */
export const theme = {
    accent: chalk.hex("#58a6ff"),
    accentDeep: chalk.hex("#3b82f6"),
    dim: chalk.dim,
    faint: chalk.gray,
    ok: chalk.green,
    err: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    user: chalk.bold,
    divider: chalk.gray,
};
/**
 * opencode-aligned mode colors: build is blue, plan is orange.
 * Used for the status-bar badges and mode-change notices.
 */
export const modeColors = {
    build: {
        badge: chalk.bgHex("#2563eb").white,
        text: chalk.hex("#60a5fa"),
    },
    plan: {
        badge: chalk.bgHex("#ea580c").black,
        text: chalk.hex("#fb923c"),
    },
};
export function modeBadge(mode) {
    return mode === "plan" ? modeColors.plan.badge(" PLAN ") : modeColors.build.badge(" BUILD ");
}
export function modeText(mode, text) {
    return (mode === "plan" ? modeColors.plan.text : modeColors.build.text)(text);
}
/** Terminal spinner frames for the running turn indicator. */
export const spinnerFrames = ["⠋", "⠙", "⠸", "⠴", "⠦", "⠧", "⠇", "⠏"];
/** Border tone for dialogs: blue by default, orange for caution/plan review. */
export const dialogBorders = {
    blue: {
        accent: chalk.bgHex("#58a6ff").black,
        border: chalk.hex("#3b82f6"),
        hint: chalk.gray,
    },
    orange: {
        accent: chalk.bgHex("#fb923c").black,
        border: chalk.hex("#ea580c"),
        hint: chalk.gray,
    },
};
export const markdownTheme = {
    heading: (text) => chalk.bold.hex("#eaf2ff")(text),
    link: (text) => chalk.underline.hex("#58a6ff")(text),
    linkUrl: (text) => chalk.dim(text),
    code: (text) => chalk.hex("#a5d6ff")(text),
    codeBlock: (text) => text,
    codeBlockBorder: (text) => chalk.dim(text),
    quote: (text) => chalk.italic.dim(text),
    quoteBorder: (text) => chalk.dim(text),
    hr: (text) => chalk.dim(text),
    listBullet: (text) => chalk.hex("#58a6ff")(text),
    bold: (text) => chalk.bold(text),
    italic: (text) => chalk.italic(text),
    strikethrough: (text) => chalk.strikethrough.dim(text),
    underline: (text) => chalk.underline(text),
};
//# sourceMappingURL=theme.js.map