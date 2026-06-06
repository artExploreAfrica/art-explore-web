import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [subCategories, tags, institutions, users] = await Promise.all([
    prisma.subCategory.count(),
    prisma.tag.count(),
    prisma.institution.count(),
    prisma.user.count(),
  ]);

  console.log('SubCategories:', subCategories);
  console.log('Tags:', tags);
  console.log('Institutions:', institutions);
  console.log('Users:', users);
  console.log('✅ Connected');
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
