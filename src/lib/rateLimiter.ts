import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import type { NextApiRequest } from "next";
import type { NextRequest } from "next/server";
import { getDashboardRedis } from "@/lib/dashboardRedis";

const redis = getDashboardRedis();

const sharedLimiter = redis
  ? new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "possum_dashboard_rl",
      points: 80,
      duration: 60,
      insuranceLimiter: new RateLimiterMemory({
        points: 80,
        duration: 60,
        keyPrefix: "possum_dashboard_rl_memory",
      }),
    })
  : new RateLimiterMemory({
      points: 80,
      duration: 60,
      keyPrefix: "possum_dashboard_rl_memory",
    });

function getHeaderValue(request: NextRequest | NextApiRequest, key: string) {
  const req: any = request as any;
  if (typeof req?.headers?.get === "function") {
    return String(req.headers.get(key) || "").trim();
  }
  const value = req?.headers?.[key] || req?.headers?.[key.toLowerCase()];
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function getClientIp(request: NextRequest | NextApiRequest) {
  const forwarded = getHeaderValue(request, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = getHeaderValue(request, "x-real-ip");
  if (realIp) return realIp;
  return "unknown-client";
}

export function isRateLimitError(error: unknown): error is { msBeforeNext: number } {
  return Boolean(error && typeof error === "object" && "msBeforeNext" in error);
}

export async function enforceDashboardRateLimit(
  request: NextRequest | NextApiRequest,
  scope = "api",
  subjectKey?: string
) {
  const subject = String(subjectKey || "").trim();
  const key = `${scope}:${subject ? `user:${subject}` : getClientIp(request)}`;
  await sharedLimiter.consume(key);
}
