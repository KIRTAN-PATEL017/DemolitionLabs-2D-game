import "dotenv/config";
import { Kafka } from "kafkajs";
import { S3Client, PutObjectCommand, CreateBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import promClient from "prom-client";
import http from "http";

// Initialize Prometheus metrics collection
promClient.collectDefaultMetrics();

// Start a simple HTTP server to expose /metrics
// Start a simple HTTP server to expose /metrics and a health check for Cloud Run
const PORT = process.env.PORT || 3002;
const metricsServer = http.createServer(async (req, res) => {
  if (req.url === "/metrics") {
    try {
      res.setHeader("Content-Type", promClient.register.contentType);
      res.end(await promClient.register.metrics());
    } catch (err) {
      res.statusCode = 500;
      res.end("Error generating metrics");
    }
  } else if (req.url === "/" || req.url === "/health") {
    // Health check endpoint for Cloud Run startup probe
    res.statusCode = 200;
    res.end("OK");
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
});
metricsServer.listen(PORT, () => {
  console.log(`[Worker] HTTP server listening on port ${PORT}`);
});

// 1. Initialize S3 (MinIO)
const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  },
  forcePathStyle: true, // required for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "demolition-replays";

async function ensureBucketExists() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`[S3] Bucket '${BUCKET_NAME}' created.`);
  } catch (err) {
    if (err.name === 'BucketAlreadyExists' || err.name === 'BucketAlreadyOwnedByYou') {
      console.log(`[S3] Bucket '${BUCKET_NAME}' already exists.`);
    } else {
      console.error("[S3] Failed to create bucket", err);
    }
  }

  // Make the bucket public so the browser client can download replay files directly
  try {
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
        }
      ]
    };
    await s3.send(new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(policy)
    }));
    console.log(`[S3] Bucket '${BUCKET_NAME}' policy set to public read.`);
  } catch (err) {
    console.error("[S3] Failed to set bucket policy", err);
  }
}

// 2. Initialize Kafka Consumer
const kafka = new Kafka({
  clientId: "demolition-worker",
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
});

const consumer = kafka.consumer({ groupId: "replay-persistence-group" });

async function run() {
  await ensureBucketExists();

  await consumer.connect();
  console.log("[Kafka] Consumer connected");

  // Ensure topic exists to avoid UNKNOWN_TOPIC_OR_PARTITION crash
  const admin = kafka.admin();
  await admin.connect();
  const topics = await admin.listTopics();
  if (!topics.includes("match.logs")) {
    console.log("[Kafka] Creating topic 'match.logs'...");
    await admin.createTopics({
      topics: [{ topic: "match.logs", numPartitions: 1 }]
    });
  }
  await admin.disconnect();

  await consumer.subscribe({ topic: "match.logs", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.key || !message.value) return;

      const roomId = message.key.toString();
      const payload = message.value.toString();

      console.log(`[Worker] Received match log for room: ${roomId} (${payload.length} bytes)`);

      const filename = `${roomId}.json`;

      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: filename,
          Body: payload,
          ContentType: "application/json",
        }));
        console.log(`[S3] Successfully uploaded: s3://${BUCKET_NAME}/${filename}`);
      } catch (err) {
        console.error(`[S3] Failed to upload ${filename}`, err);
      }
    },
  });
}

run().catch((err) => {
  console.error(err);
});
