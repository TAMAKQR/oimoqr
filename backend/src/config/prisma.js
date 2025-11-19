import { PrismaClient } from '@prisma/client';

// Singleton pattern для PrismaClient
// Предотвращает создание множественных connection pools
const globalForPrisma = global;

const enableQueryLog = process.env.PRISMA_LOG === 'true' || process.env.NODE_ENV !== 'production';

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: enableQueryLog ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// В dev режиме сохраняем инстанс глобально для hot-reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});