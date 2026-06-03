import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

/**
 * AWS S3 client (singleton). Used only for gallery image uploads
 * (Guide §3.2 — POST /api/admin/institutions/:id/images).
 */
export const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const S3_BUCKET = env.AWS_S3_BUCKET_NAME;
export const S3_REGION = env.AWS_REGION;
