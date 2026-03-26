import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

export const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") })
  : null;

export interface DocumentJob {
  job_id: string;
  order_id: string;
  client_id: string;
  document_types: string[];
  intake_answers: Record<string, unknown>;
  product_type: string;
  partner_id?: string;
  attorney_review: boolean;
  status: "queued" | "processing" | "complete" | "failed";
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempts: number;
  error: string | null;
}

export async function addJob(job: DocumentJob): Promise<void> {
  if (!redis) {
    // Fallback: store in a simple key when Redis not configured
    console.log("Queue: Redis not configured, job stored as key", job.job_id);
    return;
  }
  await redis.hset(`job:${job.job_id}`, job as unknown as Record<string, unknown>);
  await redis.lpush("doc_queue", job.job_id);
}

export async function getJob(jobId: string): Promise<DocumentJob | null> {
  if (!redis) return null;
  const data = await redis.hgetall(`job:${jobId}`);
  if (!data || Object.keys(data).length === 0) return null;
  return data as unknown as DocumentJob;
}

export async function updateJob(jobId: string, updates: Partial<DocumentJob>): Promise<void> {
  if (!redis) return;
  await redis.hset(`job:${jobId}`, updates as Record<string, unknown>);
}

export async function popNextJob(): Promise<string | null> {
  if (!redis) return null;
  return await redis.rpop("doc_queue");
}
