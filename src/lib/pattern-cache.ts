/**
 * Pattern map cache via Upstash Redis.
 * TTL: 6 hours. Skips cache when UPSTASH_REDIS_REST_URL/TOKEN are not set.
 */

import { Redis } from "@upstash/redis";
import type { PatternMapEntry } from "./services/expected-patterns";

const TTL_SECONDS = 6 * 60 * 60; // 6 hours

function cacheKey(profileId: string, startDate: Date, days: number): string {
  const startKey =
    startDate.getFullYear() +
    "-" +
    String(startDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(startDate.getDate()).padStart(2, "0");
  return `pattern:${profileId}:${startKey}:${days}`;
}

function serialize(patternMap: Map<string, PatternMapEntry>): string {
  return JSON.stringify(Array.from(patternMap.entries()));
}

function deserialize(json: string): Map<string, PatternMapEntry> {
  const arr = JSON.parse(json) as [string, PatternMapEntry][];
  return new Map(arr);
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function getCachedPatternMap(
  profileId: string,
  startDate: Date,
  days: number,
): Promise<Map<string, PatternMapEntry> | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const key = cacheKey(profileId, startDate, days);
    const value = await redis.get<string>(key);
    if (!value || typeof value !== "string") return null;
    return deserialize(value);
  } catch {
    return null;
  }
}

export async function setCachedPatternMap(
  profileId: string,
  startDate: Date,
  days: number,
  patternMap: Map<string, PatternMapEntry>,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = cacheKey(profileId, startDate, days);
    const value = serialize(patternMap);
    await redis.set(key, value, { ex: TTL_SECONDS });
  } catch {
    // ignore
  }
}
