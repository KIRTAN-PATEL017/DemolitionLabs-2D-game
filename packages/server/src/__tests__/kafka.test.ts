import { afterEach, describe, expect, it, vi } from "vitest";

const { connectMock, sendMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("kafkajs", () => ({
  Kafka: class {
    producer() {
      return { connect: connectMock, send: sendMock };
    }
  },
  Partitioners: { LegacyPartitioner: "legacy" },
}));

import { initKafka } from "../kafka.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Kafka producer connection", () => {
  it("shares connection attempts and retries failures with backoff", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    connectMock
      .mockRejectedValueOnce(new Error("broker unavailable"))
      .mockResolvedValueOnce(undefined);

    const firstAttempt = initKafka();
    const concurrentAttempt = initKafka();

    expect(concurrentAttempt).toBe(firstAttempt);
    expect(connectMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(750);
    await Promise.all([firstAttempt, concurrentAttempt]);

    expect(connectMock).toHaveBeenCalledTimes(2);
  });
});
