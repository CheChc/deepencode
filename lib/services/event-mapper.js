/** Tool-call args preview: compact the raw JSON string for one-line display. */
export function argsPreview(argumentsRaw, max = 60) {
    const one = argumentsRaw.replace(/\s+/g, " ").trim();
    return one.length > max ? one.slice(0, max) + "…" : one;
}
/** Result summary: first non-empty text of a tool-result message's blocks. */
export function resultSummary(message, max = 100) {
    const msg = message;
    for (const block of msg?.content ?? []) {
        if (block?.type === "tool-result" && Array.isArray(block.content)) {
            for (const inner of block.content) {
                if (inner?.type === "text" && typeof inner.text === "string" && inner.text.trim() !== "") {
                    const one = inner.text.replace(/\s+/g, " ").trim();
                    return one.length > max ? one.slice(0, max) + "…" : one;
                }
            }
        }
        else if (block?.type === "text" && typeof block.text === "string" && block.text.trim() !== "") {
            const one = block.text.replace(/\s+/g, " ").trim();
            return one.length > max ? one.slice(0, max) + "…" : one;
        }
    }
    return "(空)";
}
/** Tool-call id of a tool-result message (lives inside its tool-result block). */
export function toolResultCallId(message) {
    const msg = message;
    for (const block of msg?.content ?? []) {
        if (block?.type === "tool-result" && typeof block.toolCallId === "string")
            return block.toolCallId;
    }
    return "";
}
export function assistantText(message) {
    const msg = message;
    return (msg?.content ?? [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("");
}
export function reasoningText(message) {
    const msg = message;
    return (msg?.content ?? [])
        .filter((b) => b.type === "reasoning" && typeof b.text === "string")
        .map((b) => b.text)
        .join("");
}
/**
 * Maps one raw session event onto transcript operations. The runner owns the
 * transcript + state and applies ops in order.
 */
export function mapEvent(event, state, live) {
    const ops = [];
    const e = event;
    switch (event.type) {
        case "turn/start": {
            state.assistant = undefined;
            state.thinking = undefined;
            state.tools.clear();
            break;
        }
        case "turn/end": {
            state.assistant = undefined;
            state.thinking = undefined;
            state.tools.clear();
            const reason = e.data?.reason;
            if (reason?.kind === "error" || reason?.kind === "cancelled" || reason?.kind === "aborted") {
                ops.push({ op: "divider", text: `turn ${String(reason.kind)}` });
            }
            break;
        }
        case "user/message": {
            const source = e.data?.source;
            // Only direct human prompts render as user bubbles; injected context
            // (file notices, AGENTS.md, skill content) renders dim.
            const msg = e.data;
            const text = (msg.content ?? [])
                .filter((b) => b.type === "text")
                .map((b) => b.text ?? "")
                .join("");
            if (text.trim() === "")
                break;
            // Only direct human prompts render as user bubbles. Synthetic
            // injections (system context, AGENTS.md, skill content, goal rounds)
            // are model-visible context, not conversation — the TUI renders its
            // own notices instead of echoing them.
            if (source?.kind === "user") {
                ops.push({ op: "append", item: { kind: "user", text } });
            }
            break;
        }
        case "assistant/chunk": {
            const chunk = e.data?.chunk;
            if (!chunk)
                break;
            switch (chunk.type) {
                case "text-delta": {
                    if (!state.assistant) {
                        const item = { kind: "assistant", text: "", streaming: true };
                        ops.push({ op: "append", item, stream: "assistant" });
                        state.assistant = { index: live, text: "" };
                    }
                    state.assistant.text += chunk.text ?? "";
                    ops.push({ op: "update", index: state.assistant.index, item: { kind: "assistant", text: state.assistant.text, streaming: true } });
                    break;
                }
                case "reasoning-delta": {
                    if (!state.thinking) {
                        const item = { kind: "thinking", text: "", streaming: true };
                        ops.push({ op: "append", item, stream: "thinking" });
                        state.thinking = { index: live, text: "", startedAt: Date.now() };
                    }
                    state.thinking.text += chunk.text ?? "";
                    ops.push({
                        op: "update",
                        index: state.thinking.index,
                        item: { kind: "thinking", text: state.thinking.text, streaming: true, durationMs: Date.now() - state.thinking.startedAt },
                    });
                    break;
                }
                case "tool-call-delta": {
                    // New tool call appears → open a pending row (finished by tool/call).
                    const id = chunk.id ?? "pending";
                    if (!state.tools.has(id)) {
                        const item = { kind: "tool-call", id, name: chunk.name ?? "…", argsPreview: "", running: true };
                        ops.push({ op: "append", item });
                        state.tools.set(id, { index: live, name: chunk.name ?? "…" });
                    }
                    else {
                        const t = state.tools.get(id);
                        const cur = ops.length ? undefined : undefined;
                        void cur;
                        ops.push({ op: "update", index: t.index, item: { kind: "tool-call", id, name: chunk.name ?? t.name, argsPreview: "", running: true } });
                    }
                    break;
                }
            }
            break;
        }
        case "assistant/message": {
            const text = assistantText(e.data);
            const reasoning = reasoningText(e.data);
            // Finalize: replace streamed items with the assembled message content.
            state.assistant = undefined;
            state.thinking = undefined;
            if (text !== "")
                ops.push({ op: "append", item: { kind: "assistant", text } });
            else if (reasoning !== "")
                ops.push({ op: "append", item: { kind: "thinking", text: reasoning } });
            break;
        }
        case "tool/call": {
            const { callId, name, arguments: args } = e.data;
            const existing = state.tools.get(callId);
            const item = { kind: "tool-call", id: callId, name, argsPreview: argsPreview(args), running: true };
            if (existing) {
                ops.push({ op: "update", index: existing.index, item });
            }
            else {
                ops.push({ op: "append", item });
                state.tools.set(callId, { index: live, name });
            }
            break;
        }
        case "tool/result": {
            const msg = e.data?.message;
            const error = e.data?.error;
            const callId = toolResultCallId(msg);
            const existing = state.tools.get(callId);
            const summary = error ? `错误 ${error.code}` : resultSummary(msg);
            const item = { kind: "tool-result", id: callId, name: existing?.name ?? "工具", ok: !error, summary };
            if (existing) {
                ops.push({ op: "update", index: existing.index, item });
            }
            else {
                ops.push({ op: "append", item });
            }
            break;
        }
    }
    return ops;
}
//# sourceMappingURL=event-mapper.js.map