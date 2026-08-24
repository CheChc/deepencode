import chalk from "chalk";
import { visibleWidth } from "@earendil-works/pi-tui";

/**
 * DeepSeek-inspired pixel whale at the welcome banner. Hand-drawn palette
 * sprite in the classic D/B/L/W style (D outline, B body, L belly, W mouth,
 * `.` transparent) — own artwork, not a copy of any existing sprite.
 *
 *  28×13 cells — sits beside the wordmark without wrapping on 80 columns.
 */
const SPRITE = [
  "..............DD......",
  ".............DBBD.....",
  "............DBBBD.....",
  ".....DDDDDDBBBBD.....",
  "....DBBBBBDDBBBDD....",
  "...DBBBBBBBDBBBBBBD..",
  "...DBBBBDBBBBBBBBBBD.",
  "...DBBBBDBBBBBBBBBBD.",
  "....DBBBWWWWWWBBBBD..",
  "....DBBWWWWWWWWWWWBD.",
  ".....DLLLLWWWWLLLBD..",
  "......DLLLLLLLLDDD...",
  "........DDDDDDD......",
];

const palette = {
  D: chalk.hex("#9fc8ff"), // outline — lightest
  B: chalk.hex("#3b6ea8"), // body — mid blue
  L: chalk.hex("#2a4f7d"), // belly — darker blue
  W: chalk.hex("#10294a"), // mouth — darkest, reads as an opening
} as const;

/** The whale rendered with the palette (each sprite cell mapped once). */
export function whaleMarked(): string[] {
  return SPRITE.map((row) =>
    [...row]
      .map((ch) => {
        const fn = palette[ch as keyof typeof palette];
        return fn ? fn(ch) : " ";
      })
      .join(""),
  );
}

/** Whale rows padded to a fixed column width (for side-by-side wordmark layout). */
export function whaleMarkedPadded(width = 24): string[] {
  return whaleMarked().map((line) => line + " ".repeat(Math.max(1, width - visibleWidth(line))));
}

/** Marked width in columns (for layout math). */
export const WHALE_WIDTH = 24;
export const WHALE_HEIGHT = SPRITE.length;
