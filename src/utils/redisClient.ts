// Re-export of the singleton Redis client so imports can use the path
// referenced in the Guide (utils/redisClient). The client itself lives in
// src/config/redis.ts.
export { redis } from '../config/redis';
