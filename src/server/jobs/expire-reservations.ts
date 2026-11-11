import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { expireOverdueReservations } from '@/server/services/reservation-expiry.service';

/**
 * Standalone idempotent worker script to expire overdue (>72h) reservations.
 * Can be invoked by cron, Docker health/sidecar, or external scheduler.
 * Lazy expiration in services acts as an immediate safety layer even between runs.
 */
async function main() {
  const count = await expireOverdueReservations();
  console.log(`[expire-reservations] Expired ${count} overdue reservation(s).`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('[expire-reservations] Failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
