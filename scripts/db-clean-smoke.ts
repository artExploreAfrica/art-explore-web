/** Purge any leftover smoke-test data (idempotent). */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.exhibition.deleteMany({ where: { institution: { name: { startsWith: 'SMOKE' } } } });
  const insts = await prisma.institution.deleteMany({ where: { name: { startsWith: 'SMOKE' } } });
  const tags = await prisma.tag.deleteMany({ where: { name: { startsWith: 'SMOKE' } } });
  const subs = await prisma.subCategory.deleteMany({ where: { name: { startsWith: 'SMOKE' } } });

  const smokeUsers = await prisma.user.findMany({
    where: { email: { contains: 'smoke-' } },
    select: { id: true },
  });
  const ids = smokeUsers.map((u) => u.id);
  if (ids.length) await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  const users = await prisma.user.deleteMany({ where: { email: { contains: 'smoke-' } } });

  console.log(
    `Cleaned: ${insts.count} institutions, ${tags.count} tags, ${subs.count} subcats, ${users.count} users`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
