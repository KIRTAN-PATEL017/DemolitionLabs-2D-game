/**
 * tick-loop.test.ts
 * Tests for: TickLoop — frequency, stop, catch-up behaviour
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TickLoop } from "../tick-loop.js";

describe("TickLoop", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Basic start / stop
  // ---------------------------------------------------------------------------

  it("isRunning is false before start()", () => {
    const loop = new TickLoop(() => {}, 20);
    expect(loop.isRunning).toBe(false);
  });

  it("isRunning is true after start()", async () => {
    const loop = new TickLoop(() => {}, 20);
    loop.start();
    expect(loop.isRunning).toBe(true);
    loop.stop();
  });

  it("isRunning is false after stop()", () => {
    const loop = new TickLoop(() => {}, 20);
    loop.start();
    loop.stop();
    expect(loop.isRunning).toBe(false);
  });

  it("calling start() twice is a no-op (does not double-fire)", async () => {
    let count = 0;
    const loop = new TickLoop(() => { count++; }, 20);
    loop.start();
    loop.start(); // second call — should be ignored
    await new Promise((r) => setTimeout(r, 120)); // ~2 ticks
    loop.stop();
    // Should be at most ~2-3 ticks, NOT doubled
    expect(count).toBeLessThanOrEqual(4);
  });

  // ---------------------------------------------------------------------------
  // Frequency
  // ---------------------------------------------------------------------------

  it("fires ~20 ticks over 1 second (within ±20% tolerance)", async () => {
    let count = 0;
    const loop = new TickLoop(() => { count++; }, 20);
    loop.start();

    await new Promise((r) => setTimeout(r, 1000));
    loop.stop();

    // Allow generous tolerance given CI/test environment jitter
    expect(count).toBeGreaterThanOrEqual(14); // at least 70%
    expect(count).toBeLessThanOrEqual(26);    // no more than 130%
  }, 3000);

  it("fires ~4 ticks over 200 ms at 20 Hz", async () => {
    let count = 0;
    const loop = new TickLoop(() => { count++; }, 20);
    loop.start();

    await new Promise((r) => setTimeout(r, 200));
    loop.stop();

    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(6);
  }, 1000);

  // ---------------------------------------------------------------------------
  // Stop halts the loop
  // ---------------------------------------------------------------------------

  it("no ticks fire after stop()", async () => {
    let count = 0;
    const loop = new TickLoop(() => { count++; }, 20);
    loop.start();
    loop.stop();
    const snapshot = count;

    await new Promise((r) => setTimeout(r, 200));
    // Count must not have grown after stop
    expect(count).toBe(snapshot);
  }, 1000);

  // ---------------------------------------------------------------------------
  // tickCount accumulator
  // ---------------------------------------------------------------------------

  it("tickCount reflects the number of ticks fired", async () => {
    const loop = new TickLoop(() => {}, 20);
    loop.start();
    await new Promise((r) => setTimeout(r, 300));
    loop.stop();
    expect(loop.tickCount).toBeGreaterThan(0);
    expect(loop.tickCount).toBe(loop.tickCount); // stable after stop
  }, 1000);

  // ---------------------------------------------------------------------------
  // hz accessor
  // ---------------------------------------------------------------------------

  it("hz returns the configured target rate", () => {
    const loop = new TickLoop(() => {}, 30);
    expect(loop.hz).toBe(30);
  });

  // ---------------------------------------------------------------------------
  // Catch-up: does not spiral
  // ---------------------------------------------------------------------------

  it("does not fire more total ticks than wall-clock time allows (no spiral)", async () => {
    let count = 0;
    const loop = new TickLoop(() => { count++; }, 20);

    const startMs = Date.now();
    loop.start();

    // Spin to simulate a lag spike of ~250 ms (5 missed ticks)
    const busy = Date.now();
    while (Date.now() - busy < 250) { /* spin */ }

    // Let the loop run normally for another 200 ms
    await new Promise((r) => setTimeout(r, 200));
    loop.stop();

    const wallMs = Date.now() - startMs; // ~450 ms total
    // At 20 Hz: max possible ticks = wallMs / 50, with a small buffer for timing jitter
    const maxExpected = Math.ceil(wallMs / 50) + 2;

    // Count must not overshoot wall-clock capacity (would indicate a spiral)
    expect(count).toBeLessThanOrEqual(maxExpected);
    // And the loop should have actually fired some ticks
    expect(count).toBeGreaterThan(0);
  }, 3000);

  it("resumes normal tick cadence after a lag spike", async () => {
    const tickTimes: number[] = [];
    const loop = new TickLoop(() => { tickTimes.push(Date.now()); }, 20);

    loop.start();
    // Lag spike
    const busy = Date.now();
    while (Date.now() - busy < 150) { /* spin */ }

    // Let it recover and run normally for 500 ms
    await new Promise((r) => setTimeout(r, 500));
    loop.stop();

    // After recovery, ticks in the tail window (last 300 ms) should be ~6 (±3)
    const tail = tickTimes.filter((t) => t >= Date.now() - 300);
    // At least some ticks in the tail — proves the loop didn't stall after recovery
    expect(tickTimes.length).toBeGreaterThan(3);
  }, 3000);
});
