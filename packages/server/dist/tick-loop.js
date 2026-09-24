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
const NS_PER_MS = 1000000n;
const NS_PER_S = 1000000000n;
/** Maximum number of catch-up ticks processed in a single scheduling slot. */
const MAX_CATCH_UP_TICKS = 2;
/** Log a warning if a single tick callback takes longer than this (ms). */
const WARN_THRESHOLD_MS = 40;
export class TickLoop {
    onTick;
    intervalNs;
    targetHz;
    running = false;
    lastTickNs = 0n;
    immediateHandle = null;
    /** Total ticks fired since start (for diagnostics). */
    tickCount = 0;
    constructor(onTick, targetHz = 20) {
        this.onTick = onTick;
        this.targetHz = targetHz;
        // Nanoseconds per tick
        this.intervalNs = NS_PER_S / BigInt(targetHz);
    }
    /** Start the loop. Safe to call only once; calling again while running is a no-op. */
    start() {
        if (this.running)
            return;
        this.running = true;
        this.lastTickNs = process.hrtime.bigint();
        this.schedule();
    }
    /** Stop the loop. The in-flight `setImmediate` is cancelled; no more ticks fire. */
    stop() {
        this.running = false;
        if (this.immediateHandle !== null) {
            clearImmediate(this.immediateHandle);
            this.immediateHandle = null;
        }
    }
    get isRunning() {
        return this.running;
    }
    get hz() {
        return this.targetHz;
    }
    // ---------------------------------------------------------------------------
    // Private scheduling
    // ---------------------------------------------------------------------------
    schedule() {
        if (!this.running)
            return;
        this.immediateHandle = setImmediate(() => this.frame());
    }
    frame() {
        if (!this.running)
            return;
        const now = process.hrtime.bigint();
        const elapsed = now - this.lastTickNs;
        if (elapsed < this.intervalNs) {
            // Not yet time — re-schedule
            this.schedule();
            return;
        }
        // How many ticks have we missed?
        const ticksOwed = Number(elapsed / this.intervalNs);
        const catchUpCount = Math.min(ticksOwed, MAX_CATCH_UP_TICKS);
        for (let i = 0; i < catchUpCount; i++) {
            const tickStart = process.hrtime.bigint();
            this.onTick();
            this.tickCount++;
            const tickDurationMs = Number((process.hrtime.bigint() - tickStart) / NS_PER_MS);
            if (tickDurationMs > WARN_THRESHOLD_MS) {
                console.warn(`[TickLoop] Slow tick #${this.tickCount}: ${tickDurationMs} ms ` +
                    `(budget: ${Math.round(1000 / this.targetHz)} ms)`);
            }
        }
        // Advance lastTickNs by the number of ticks actually processed
        // (not by elapsed) to keep the long-run average accurate
        this.lastTickNs += this.intervalNs * BigInt(catchUpCount);
        this.schedule();
    }
}
//# sourceMappingURL=tick-loop.js.map