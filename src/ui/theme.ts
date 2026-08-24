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
} as const;

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
} as const;

export function modeBadge(mode: "build" | "plan"): string {
  return mode === "plan" ? modeColors.plan.badge(" PLAN ") : modeColors.build.badge(" BUILD ");
}

export function modeText(mode: "build" | "plan", text: string): string {
  return (mode === "plan" ? modeColors.plan.text : modeColors.build.text)(text);
}

export const markdownTheme = {
  heading: (text: string) => chalk.bold.hex("#eaf2ff")(text),
  link: (text: string) => chalk.underline.hex("#58a6ff")(text),
  linkUrl: (text: string) => chalk.dim(text),
  code: (text: string) => chalk.hex("#a5d6ff")(text),
  codeBlock: (text: string) => text,
  codeBlockBorder: (text: string) => chalk.dim(text),
  quote: (text: string) => chalk.italic.dim(text),
  quoteBorder: (text: string) => chalk.dim(text),
  hr: (text: string) => chalk.dim(text),
  listBullet: (text: string) => chalk.hex("#58a6ff")(text),
  bold: (text: string) => chalk.bold(text),
  italic: (text: string) => chalk.italic(text),
  strikethrough: (text: string) => chalk.strikethrough.dim(text),
  underline: (text: string) => chalk.underline(text),
};
