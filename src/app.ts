import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../swagger/swagger.config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import apiRoutes from './routes';
import { successResponse } from './utils/response';

const app: Application = express();

// Security & parsing.
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check.
app.get('/health', (_req: Request, res: Response) =>
  successResponse(res, { status: 'ok', uptime: process.uptime() }, 'Service healthy'),
);

// API routes.
app.use('/api', apiRoutes);

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
