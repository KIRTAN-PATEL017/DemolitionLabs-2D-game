import { GameInput } from "@demolition-labs/engine";

export interface LogTick {
  tick: number;
  inputs: [string, GameInput][];
}

export interface MatchLog {
  roomId: string;
  seed: number;
  playerOrder: string[];
  ticks: LogTick[];
}

/**
 * Collects a deterministic input log for an entire match.
 * The log can be compressed and sent to AWS S3 / MinIO via Kafka.
 */
export class EventLogger {
  private log: MatchLog;

  constructor(roomId: string, seed: number, playerOrder: string[]) {
    this.log = {
      roomId,
      seed,
      playerOrder: [...playerOrder],
      ticks: []
    };
  }

  /**
   * Called exactly once per room tick.
   * Only saves ticks that have actual inputs to keep the JSON small.
   */
  logTick(tick: number, inputs: Map<string, GameInput>): void {
    if (inputs.size === 0) return;

    // Filter out pure NOOPs if we want to save space, but NOOP means "did nothing".
    const activeInputs: [string, GameInput][] = [];
    for (const [playerId, input] of inputs.entries()) {
      if (input.type !== "NOOP") {
        activeInputs.push([playerId, input]);
      }
    }

    if (activeInputs.length > 0) {
      this.log.ticks.push({ tick, inputs: activeInputs });
    }
  }

  getLog(): MatchLog {
    return this.log;
  }
}
