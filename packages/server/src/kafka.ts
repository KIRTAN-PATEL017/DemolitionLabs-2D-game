import { Kafka, Partitioners } from "kafkajs";
import type { MatchLog } from "./EventLogger.js";

const kafka = new Kafka({
  clientId: "demolition-server",
  brokers: (process.env["KAFKA_BROKERS"] || "localhost:9092").split(","),
  retry: {
    initialRetryTime: 500,
    maxRetryTime: 2_000,
    retries: 2,
  },
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

let connected = false;
let connectionPromise: Promise<void> | undefined;

export function initKafka(): Promise<void> {
  if (connected) return Promise.resolve();
  if (connectionPromise) return connectionPromise;

  connectionPromise = connectWithBackoff().finally(() => {
    connectionPromise = undefined;
  });
  return connectionPromise;
}

async function connectWithBackoff(): Promise<void> {
  let delayMs = INITIAL_RECONNECT_DELAY_MS;

  while (!connected) {
    try {
      await producer.connect();
      connected = true;
      console.log("[Kafka] Producer connected");
    } catch (err) {
      const retryDelayMs = Math.round(delayMs * (0.75 + Math.random() * 0.5));
      console.error(`[Kafka] Producer connection failed; retrying in ${retryDelayMs}ms`, err);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      delayMs = Math.min(delayMs * 2, MAX_RECONNECT_DELAY_MS);
    }
  }
}

export async function publishMatchLog(log: MatchLog) {
  try {
    const payload = JSON.stringify(log);
    await producer.send({
      topic: "match.logs",
      messages: [
        {
          key: log.roomId,
          value: payload,
        },
      ],
    });
    console.log(`[Kafka] Published match log for room ${log.roomId} (${payload.length} bytes)`);
  } catch (err) {
    connected = false;
    console.error("[Kafka] Failed to publish match log", err);
    void initKafka();
  }
}
