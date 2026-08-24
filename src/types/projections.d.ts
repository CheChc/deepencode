export {};
declare module "@deepseek-ai/dsh-session-projection" {
  interface SessionProjectionStateMap {
    tokenUsage?: { totals: { uncachedInputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }; last: { turn: number; step: number } | null };
    contextPressure?: { contextWindow?: number; pressureTokens?: number; surfaceTokens: number; sampledSurfaceTokens?: number; claim?: unknown };
  }
}
