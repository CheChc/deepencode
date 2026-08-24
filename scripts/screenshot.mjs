#!/usr/bin/env node
/**
 * Terminal screenshot generator: replays a captured raw ANSI stream (from a
 * scripted `dsh --profile tui` session) through an xterm/headless emulator,
 * renders the final screen state as HTML, and screenshots it with headless
 * Chrome.
 *
 * Usage:
 *   node scripts/screenshot.mjs <input.raw> <cols> <rows> <output.png>
 */
import pkg from "@xterm/headless";
const { Terminal } = pkg;
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [inputPath, colsArg, rowsArg, outPath] = process.argv.slice(2);
if (!inputPath || !colsArg || !rowsArg || !outPath) {
  console.error("用法: node scripts/screenshot.mjs <input.raw> <cols> <rows> <output.png>");
  process.exit(1);
}
const COLS = Number(colsArg);
const ROWS = Number(rowsArg);

const bytes = readFileSync(inputPath);
const term = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true, scrollback: 0 });
term.write(bytes.toString("utf8"));
// xterm/headless 的解析排队在事件循环中,等待结算后再读缓冲区。
await new Promise((r) => setTimeout(r, 120));

const CHAR_W = 8.4; // Menlo @14px advance
const LINE_H = 19;
const PAD = 24;

const RGB_MODE = 0x03000000; // xterm.js Attributes.CM_RGB
const P256_MODE = 0x02000000; // Attributes.CM_P256
const P16_MODE = 0x01000000; // Attributes.CM_P16
const isRgb = (mode) => (mode & RGB_MODE) === RGB_MODE;

// 标准 16 色表(ANSI 0-15)
const PALETTE_16 = [
  0x000000, 0x800000, 0x008000, 0x808000, 0x000080, 0x800080, 0x008080, 0xc0c0c0,
  0x808080, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff,
];
// xterm 256 色表:16-231 为 6×6×6 立方,232-255 为灰阶
const PALETTE_256 = (() => {
  const t = [...PALETTE_16];
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    t.push(((r * 51) << 16) | ((g * 51) << 8) | (b * 51));
  }
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    t.push((v << 16) | (v << 8) | v);
  }
  return t;
})();

/** 将 cell 颜色模式解析为 RGB 数值或 null(默认色)。 */
function resolveColor(mode, value) {
  if (mode === 0) return null;
  if ((mode & RGB_MODE) === RGB_MODE) return value & 0xffffff;
  const idx = value & 0xff;
  if ((mode & P256_MODE) === P256_MODE) return PALETTE_256[idx];
  if ((mode & P16_MODE) === P16_MODE) return PALETTE_16[idx & 15];
  return null;
}

function isWide(ch) {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK Radicals..Yi
    (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compat Ideographs
    (code >= 0xfe10 && code <= 0xfe6f) || // Vertical forms / small forms
    (code >= 0xff00 && code <= 0xff60) || // Fullwidth forms
    (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth signs
    code >= 0x1f300 // emoji and beyond
  );
}

const lines = [];
const buffer = term.buffer.active;
for (let y = 0; y < ROWS; y++) {
  const line = buffer.getLine(y);
  let html = "";
  let span = null;
  let spanText = "";
  let spanColor = "";
  let spanBg = "";

  const flush = () => {
    if (spanText === "") return;
    const style = [];
    if (spanColor) style.push(`color:${spanColor}`);
    if (spanBg) style.push(`background:${spanBg}`);
    html += `<span${style.length ? ` style="${style.join(";")}"` : ""}>${esc(spanText)}</span>`;
    spanText = "";
  };

  for (let x = 0; x < COLS; x++) {
    const cell = line.getCell(x);
    const ch = cell.getChars();
    const wide = isWide(ch);
    const width = wide ? 2 : 1;
    const fgMode = cell.getFgColorMode();
    const bgMode = cell.getBgColorMode();
    const fg = resolveColor(fgMode, cell.getFgColor());
    const bg = resolveColor(bgMode, cell.getBgColor());
    // 默认前景(无 SGR 色)按亮灰渲染,避免黑底黑字。
    const color = fg !== null ? `#${fg.toString(16).padStart(6, "0")}` : "#c9d1d9";
    const bgc = bg !== null ? `#${bg.toString(16).padStart(6, "0")}` : "#000000";
    if (color !== spanColor || bgc !== spanBg) {
      flush();
      spanColor = color;
      spanBg = bgc;
    }
    spanText += ch || " ";
    // 宽字符占 2 格;xterm 在其后补一个空 cell
    if (wide) x += 1;
    if (x === COLS - 1 || (wide && x === COLS)) flush();
    if (width === 2 && spanText.length > 0 && (x === COLS - 1)) flush();
    if (wide) flush();
  }
  flush();
  lines.push(html);
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const width = COLS * CHAR_W + PAD * 2;
const height = ROWS * LINE_H + PAD * 2;
const htmlDoc = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin:0; padding:${PAD}px; background:#000; }
  .screen { font-family:"Menlo","Monaco","PingFang SC","monospace"; font-size:14px;
    line-height:${LINE_H}px; letter-spacing:0; white-space:pre; }
  .screen span { display:inline-block; min-width:${CHAR_W}px; }
  .line { height:${LINE_H}px; }
</style></head><body><div class="screen">${lines.map((l) => `<div class="line">${l}</div>`).join("")}</div></body></html>`;

const htmlPath = outPath.replace(/\.png$/, ".html");
writeFileSync(htmlPath, htmlDoc);

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fileUrl = pathToFileURL(resolve(htmlPath)).href;
const result = spawnSync(
  chrome,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    `--window-size=${Math.round(width)},${Math.round(height)}`,
    `--screenshot=${outPath}`,
    fileUrl,
  ],
  { encoding: "utf8", timeout: 30000 },
);
if (result.status !== 0) {
  console.error("Chrome 截图失败:", result.stderr?.slice(0, 500));
  process.exit(1);
}
console.log(`已生成 ${outPath} (${Math.round(width)}x${Math.round(height)} @2x)`);
