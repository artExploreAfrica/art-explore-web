import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Single PrismaClient instance for the whole app (singleton).
 * Import this everywhere — never instantiate PrismaClient elsewhere.
 *
 * In development we stash the client on `globalThis` so that ts-node-dev's
 * respawns don't exhaust the connection pool with new clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
