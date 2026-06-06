import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { S3_BUCKET, S3_REGION, s3 } from '../config/s3';
import { AppError } from './AppError';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export interface UploadableFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Uploads an image buffer to S3 under `institutions/{id}/...` and returns the
 * public object URL. Used by POST /api/v1/admin/institutions/:id/images.
 */
export const uploadInstitutionImage = async (
  institutionId: string,
  file: UploadableFile,
): Promise<string> => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new AppError(
      `Unsupported image type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, GIF.`,
      400,
    );
  }

  const ext = extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
  const key = `institutions/${institutionId}/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
};

/**
 * Uploads an exhibition image to S3 under
 * `exhibitions/{institutionId}/{exhibitionId}/...` and returns the public URL.
 * Used by POST /api/v1/admin/institutions/:id/exhibitions/:exhibitionId/image.
 */
export const uploadExhibitionImage = async (
  institutionId: string,
  exhibitionId: string,
  file: UploadableFile,
): Promise<string> => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new AppError(
      `Unsupported image type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, GIF.`,
      400,
    );
  }

  const ext = extname(file.originalname) || `.${file.mimetype.split('/')[1]}`;
  const key = `exhibitions/${institutionId}/${exhibitionId}/${randomUUID()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );

  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
};
