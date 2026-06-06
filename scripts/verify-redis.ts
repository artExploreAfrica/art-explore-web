import 'dotenv/config';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL as string,
  token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
});

async function main(): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing from .env');
  }

  const key = 'healthcheck:verify';
  const stamp = `ok-${Date.now()}`;

  await redis.set(key, stamp, { ex: 30 });
  const readBack = await redis.get<string>(key);
  await redis.del(key);

  if (readBack !== stamp) {
    throw new Error(`Round-trip mismatch: wrote "${stamp}", read "${readBack}"`);
  }

  console.log('Set/get/del round-trip:', readBack);
  console.log('✅ Redis connected');
}

main().catch((err) => {
  console.error('❌ Redis failed:', err.message);
  process.exit(1);
});
