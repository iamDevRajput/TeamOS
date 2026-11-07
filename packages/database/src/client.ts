import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __teamos_prisma: PrismaClient | undefined;
}

/**
 * Internal Prisma client singleton.
 * Private to packages/database; never export outside this package.
 */
export const prisma =
  global.__teamos_prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ||
          'postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public',
      },
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__teamos_prisma = prisma;
}

