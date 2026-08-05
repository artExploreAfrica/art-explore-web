import multer from 'multer';
import { AppError } from '../utils/AppError';

/** Largest image we accept, in bytes. Surfaced in the 413 message below. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * In-memory multer storage — the buffer is streamed straight to S3 by
 * s3Uploader, so nothing touches local disk. 5 MB per image, single file.
 *
 * The filter rejects with an AppError rather than a bare Error so the rejection
 * lands on errorHandler's operational-error branch as a 400 instead of falling
 * through to the unknown-error 500. Multer's own limit breaches raise a
 * MulterError, which errorHandler maps separately.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Only image files are allowed (received "${file.mimetype}")`,
          400,
        ),
      );
    }
  },
}).single('image');
