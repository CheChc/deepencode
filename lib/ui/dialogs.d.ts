import type { OverlayHandle, TUI } from "@earendil-works/pi-tui";
export interface PickItem {
    value: string;
    label: string;
    description?: string;
}
/** Modal single-choice picker (models, presets, providers…). */
export declare function pickOne(tui: TUI, title: string, items: PickItem[], onPick: (value: string) => void, onCancel?: () => void): OverlayHandle;
/** Modal option picker for approvals and questions. */
export declare function pickOption(tui: TUI, title: string, body: string, options: PickItem[], onPick: (value: string) => void, onCancel?: () => void): OverlayHandle;
/** Modal single-line free-text prompt (provider fields, "Other…" answers). */
export declare function promptText(tui: TUI, title: string, initial: string, onSubmit: (text: string) => void, onCancel?: () => void): OverlayHandle;
//# sourceMappingURL=dialogs.d.ts.map