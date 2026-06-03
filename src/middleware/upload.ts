import multer from 'multer';

/**
 * In-memory multer storage — the buffer is streamed straight to S3 by
 * s3Uploader, so nothing touches local disk. 5 MB per image, single file.
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
}).single('image');
