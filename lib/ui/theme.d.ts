/** Central color/typography palette for the whole terminal surface. */
export declare const theme: {
    readonly accent: import("chalk").ChalkInstance;
    readonly accentDeep: import("chalk").ChalkInstance;
    readonly dim: import("chalk").ChalkInstance;
    readonly faint: import("chalk").ChalkInstance;
    readonly ok: import("chalk").ChalkInstance;
    readonly err: import("chalk").ChalkInstance;
    readonly warn: import("chalk").ChalkInstance;
    readonly info: import("chalk").ChalkInstance;
    readonly user: import("chalk").ChalkInstance;
    readonly divider: import("chalk").ChalkInstance;
};
/**
 * opencode-aligned mode colors: build is blue, plan is orange.
 * Used for the status-bar badges and mode-change notices.
 */
export declare const modeColors: {
    readonly build: {
        readonly badge: import("chalk").ChalkInstance;
        readonly text: import("chalk").ChalkInstance;
    };
    readonly plan: {
        readonly badge: import("chalk").ChalkInstance;
        readonly text: import("chalk").ChalkInstance;
    };
};
export declare function modeBadge(mode: "build" | "plan"): string;
export declare function modeText(mode: "build" | "plan", text: string): string;
export declare const markdownTheme: {
    heading: (text: string) => string;
    link: (text: string) => string;
    linkUrl: (text: string) => string;
    code: (text: string) => string;
    codeBlock: (text: string) => string;
    codeBlockBorder: (text: string) => string;
    quote: (text: string) => string;
    quoteBorder: (text: string) => string;
    hr: (text: string) => string;
    listBullet: (text: string) => string;
    bold: (text: string) => string;
    italic: (text: string) => string;
    strikethrough: (text: string) => string;
    underline: (text: string) => string;
};
//# sourceMappingURL=theme.d.ts.map