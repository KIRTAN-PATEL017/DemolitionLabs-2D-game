/**
 * tick-loop.ts
 * ------------
 * Step 2.1 — Fixed 20 Hz drift-corrected tick loop.
 *
 * Design goals:
 *   - Deliver exactly one `onTick` callback per 50 ms wall-clock window.
 *   - Use `process.hrtime.bigint()` (nanosecond precision) rather than
 *     `setInterval` to avoid timer drift accumulation over long sessions.
 *   - Use `setImmediate` as the scheduling primitive so the event loop
 *     can still process I/O (incoming WS messages) between ticks.
 *   - Detect lag spikes: if the event loop was blocked, catch up by
 *     processing at most MAX_CATCH_UP_TICKS before resuming real-time.
 *   - Emit a slow-tick warning log when a tick takes > WARN_THRESHOLD_MS.
 *
 * Usage:
 *   const loop = new TickLoop(() => room.tick(), 20);
 *   loop.start();
 *   // ... later:
 *   loop.stop();
 */
export declare class TickLoop {
    private readonly onTick;
    private readonly intervalNs;
    private readonly targetHz;
    private running;
    private lastTickNs;
    private immediateHandle;
    /** Total ticks fired since start (for diagnostics). */
    tickCount: number;
    constructor(onTick: () => void, targetHz?: number);
    /** Start the loop. Safe to call only once; calling again while running is a no-op. */
    start(): void;
    /** Stop the loop. The in-flight `setImmediate` is cancelled; no more ticks fire. */
    stop(): void;
    get isRunning(): boolean;
    get hz(): number;
    private schedule;
    private frame;
}
//# sourceMappingURL=tick-loop.d.ts.map