import chalk from "chalk";
/** Central color/typography palette for the whole terminal surface. */
export const theme = {
    accent: chalk.hex("#9ec7ff"),
    accentDeep: chalk.hex("#6f9fe0"),
    dim: chalk.dim,
    faint: chalk.gray,
    ok: chalk.green,
    err: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    user: chalk.bold,
    divider: chalk.gray,
};
export const markdownTheme = {
    heading: (text) => chalk.bold.hex("#eaf2ff")(text),
    link: (text) => chalk.underline.hex("#9ec7ff")(text),
    linkUrl: (text) => chalk.dim(text),
    code: (text) => chalk.hex("#a5d6ff")(text),
    codeBlock: (text) => text,
    codeBlockBorder: (text) => chalk.dim(text),
    quote: (text) => chalk.italic.dim(text),
    quoteBorder: (text) => chalk.dim(text),
    hr: (text) => chalk.dim(text),
    listBullet: (text) => chalk.hex("#9ec7ff")(text),
    bold: (text) => chalk.bold(text),
    italic: (text) => chalk.italic(text),
    strikethrough: (text) => chalk.strikethrough.dim(text),
    underline: (text) => chalk.underline(text),
};
//# sourceMappingURL=theme.js.map