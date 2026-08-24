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
} as const;

export const markdownTheme = {
  heading: (text: string) => chalk.bold.hex("#eaf2ff")(text),
  link: (text: string) => chalk.underline.hex("#9ec7ff")(text),
  linkUrl: (text: string) => chalk.dim(text),
  code: (text: string) => chalk.hex("#a5d6ff")(text),
  codeBlock: (text: string) => text,
  codeBlockBorder: (text: string) => chalk.dim(text),
  quote: (text: string) => chalk.italic.dim(text),
  quoteBorder: (text: string) => chalk.dim(text),
  hr: (text: string) => chalk.dim(text),
  listBullet: (text: string) => chalk.hex("#9ec7ff")(text),
  bold: (text: string) => chalk.bold(text),
  italic: (text: string) => chalk.italic(text),
  strikethrough: (text: string) => chalk.strikethrough.dim(text),
  underline: (text: string) => chalk.underline(text),
};
