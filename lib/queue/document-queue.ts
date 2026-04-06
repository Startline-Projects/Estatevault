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

function sanitizeForRedis(obj: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = "";
    } else if (typeof value === "object") {
      sanitized[key] = JSON.stringify(value);
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}

export async function addJob(job: DocumentJob): Promise<void> {
  if (!redis) {
    console.log("Queue: Redis not configured, job not queued", job.job_id);
    return;
  }
  const sanitized = sanitizeForRedis(job as unknown as Record<string, unknown>);
  await redis.hset(`job:${job.job_id}`, sanitized);
  await redis.lpush("doc_queue", job.job_id);
}

export async function getJob(jobId: string): Promise<DocumentJob | null> {
  if (!redis) return null;
  const data = await redis.hgetall(`job:${jobId}`);
  if (!data || Object.keys(data).length === 0) return null;
  // Parse stringified fields back
  const raw = data as Record<string, string>;
  return {
    ...raw,
    document_types: raw.document_types
      ? (Array.isArray(raw.document_types) ? raw.document_types : JSON.parse(raw.document_types as string))
      : [],
    intake_answers: raw.intake_answers
      ? (typeof raw.intake_answers === "object" && !Array.isArray(raw.intake_answers) ? raw.intake_answers as Record<string, unknown> : JSON.parse(raw.intake_answers as string))
      : {},
    partner_id: raw.partner_id || undefined,
    attorney_review: raw.attorney_review === "true",
    started_at: raw.started_at || null,
    completed_at: raw.completed_at || null,
    attempts: parseInt(raw.attempts || "0", 10),
    error: raw.error || null,
  } as unknown as DocumentJob;
}

export async function updateJob(jobId: string, updates: Partial<DocumentJob>): Promise<void> {
  if (!redis) return;
  const sanitized = sanitizeForRedis(updates as unknown as Record<string, unknown>);
  await redis.hset(`job:${jobId}`, sanitized);
}

export async function popNextJob(): Promise<string | null> {
  if (!redis) return null;
  return await redis.rpop("doc_queue");
}
