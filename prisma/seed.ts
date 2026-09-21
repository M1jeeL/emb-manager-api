import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Ejecutando seed...');
  const plan = await prisma.plan.upsert({
    where: {
      code: 'STANDARD',
    },
    update: {},
    create: {
      code: 'STANDARD',
      name: 'Standard',
      description: 'Plan estándar del sistema de bordados',
      monthlyPrice: 0,
      trialDays: 7,
      active: true,
    },
  });

  console.log(`✅ Plan creado/verificado: ${plan.code}`);
  console.log('🌱 Seed completado');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
