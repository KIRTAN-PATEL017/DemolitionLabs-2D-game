import { Kafka, Partitioners } from "kafkajs";
import type { MatchLog } from "./EventLogger.js";

const kafka = new Kafka({
  clientId: "demolition-server",
  brokers: (process.env["KAFKA_BROKERS"] || "localhost:9092").split(","),
});

const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner
});

export async function initKafka() {
  await producer.connect();
  console.log("[Kafka] Producer connected");
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
    console.error("[Kafka] Failed to publish match log", err);
  }
}
