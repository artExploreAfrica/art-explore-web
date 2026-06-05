import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../swagger/swagger.config';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import apiRoutes from './routes';
import { successResponse } from './utils/response';

const app: Application = express();

// Trust the first proxy hop (TLS terminates at Nginx/ALB/Cloudflare in prod) so
// req.ip reflects the real client for rate limiting. See docs/deployment.md.
app.set('trust proxy', 1);

// Restrict CORS to ALLOWED_ORIGINS when set; otherwise reflect any origin.
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

// Security & parsing.
app.use(helmet());
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check.
app.get('/health', (_req: Request, res: Response) =>
  successResponse(res, { status: 'ok', uptime: process.uptime() }, 'Service healthy'),
);

// API routes (versioned).
app.use('/api/v1', apiRoutes);

// Swagger docs.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// 404 + centralized error handling (must be last).
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
