import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Zod schema for all required environment variables.
 * Validation runs once at module load — if anything is missing or malformed,
 * the process crashes immediately with a clear, actionable message.
 */
const envSchema = z
  .object({
    // Server
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    // Comma-separated list of allowed CORS origins.
    // Required in production; empty/unset = allow any origin in development/test.
    ALLOWED_ORIGINS: z.string().optional(),

    // PostgreSQL
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
    JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // AWS S3
    AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
    AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
    AWS_S3_BUCKET_NAME: z.string().min(1, 'AWS_S3_BUCKET_NAME is required'),

    // Upstash Redis
    UPSTASH_REDIS_REST_URL: z.string().url('UPSTASH_REDIS_REST_URL must be a valid URL'),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'UPSTASH_REDIS_REST_TOKEN is required'),

    // Email (Resend). RESEND_API_KEY is optional — mailer no-ops until set.
    // EMAIL_FROM must be a verified Resend sender/domain; FRONTEND_URL is the
    // public web app base used to build password-reset and login links. Both
    // fall back to dev placeholders so a deployment that runs without email
    // still boots; the superRefine below demands real values once Resend is on.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z
      .string()
      .email('EMAIL_FROM must be a valid email address')
      .default('no-reply@localhost'),
    FRONTEND_URL: z
      .string()
      .url('FRONTEND_URL must be a valid URL')
      .default('http://localhost:5173'),

    // Seed (optional at runtime; required only when running the seed script)
    SEED_SUPER_ADMIN_NAME: z.string().optional(),
    SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
    SEED_SUPER_ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.ALLOWED_ORIGINS?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOWED_ORIGINS'],
        message: 'ALLOWED_ORIGINS is required in production',
      });
    }

    // Once Resend is configured the placeholders above would produce a bad
    // sender and dead reset links, so require both to be set explicitly.
    // Checked against the raw environment so an explicit value that happens to
    // match a placeholder is still accepted.
    if (data.RESEND_API_KEY) {
      for (const key of ['EMAIL_FROM', 'FRONTEND_URL'] as const) {
        if (!process.env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when RESEND_API_KEY is set`,
          });
        }
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
