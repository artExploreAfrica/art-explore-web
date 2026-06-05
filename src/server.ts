import app from './app';
import { env } from './config/env';
import prisma from './config/db';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Art Explore API listening on http://localhost:${env.PORT}`);
  console.log(`📚 Swagger UI at   http://localhost:${env.PORT}/api-docs`);
  console.log(`🌍 Environment:    ${env.NODE_ENV}`);
});

/** Graceful shutdown — close the HTTP server and Prisma connection. */
const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
