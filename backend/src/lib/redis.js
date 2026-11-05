import Redis from "ioredis";
import "dotenv/config"

export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // when Redis is down, fail fast instead of queueing
    })
  : null;


redis?.on("error", (e) => console.error("Redis error:", e.message));
