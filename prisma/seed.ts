import 'dotenv/config';
import {
  PrismaClient,
  UserRole,
  UnitStatus,
  ReservationStatus,
  ContractStatus,
  InstallmentStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to run seed');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Local development/evaluation password only. Do NOT use in production.
const SEED_DEV_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'AqarElite!2026';

async function main() {
  const passwordHash = await bcrypt.hash(SEED_DEV_PASSWORD, 12);

  // Company A
  const companyA = await prisma.company.upsert({
    where: { id: 'cmp_nukhba_a' },
    update: { name: 'شركة النخبة العقارية' },
    create: {
      id: 'cmp_nukhba_a',
      name: 'شركة النخبة العقارية',
    },
  });

  // Company B
  const companyB = await prisma.company.upsert({
    where: { id: 'cmp_mustaqbal_b' },
    update: { name: 'شركة دار المستقبل للتطوير' },
    create: {
      id: 'cmp_mustaqbal_b',
      name: 'شركة دار المستقبل للتطوير',
    },
  });

  const users = [
    // Company A: 1 ADMIN, 1 ACCOUNTANT, 2 SALES
    {
      id: 'usr_a_admin',
      email: 'admin.a@nukhba.local',
      name: 'خالد المنصور (مدير النخبة)',
      role: UserRole.ADMIN,
      companyId: companyA.id,
    },
    {
      id: 'usr_a_accountant',
      email: 'accountant.a@nukhba.local',
      name: 'سارة العتيبي (محاسب النخبة)',
      role: UserRole.ACCOUNTANT,
      companyId: companyA.id,
    },
    {
      id: 'usr_a_sales1',
      email: 'sales1.a@nukhba.local',
      name: 'أحمد السالم (مندوب النخبة 1)',
      role: UserRole.SALES,
      companyId: companyA.id,
    },
    {
      id: 'usr_a_sales2',
      email: 'sales2.a@nukhba.local',
      name: 'ريم القحطاني (مندوب النخبة 2)',
      role: UserRole.SALES,
      companyId: companyA.id,
    },
    // Company B: 1 ADMIN, 1 ACCOUNTANT, 2 SALES
    {
      id: 'usr_b_admin',
      email: 'admin.b@mustaqbal.local',
      name: 'فهد الدوسري (مدير المستقبل)',
      role: UserRole.ADMIN,
      companyId: companyB.id,
    },
    {
      id: 'usr_b_accountant',
      email: 'accountant.b@mustaqbal.local',
      name: 'نورة الحربي (محاسب المستقبل)',
      role: UserRole.ACCOUNTANT,
      companyId: companyB.id,
    },
    {
      id: 'usr_b_sales1',
      email: 'sales1.b@mustaqbal.local',
      name: 'عمر الزهراني (مندوب المستقبل 1)',
      role: UserRole.SALES,
      companyId: companyB.id,
    },
    {
      id: 'usr_b_sales2',
      email: 'sales2.b@mustaqbal.local',
      name: 'لينا الشهري (مندوب المستقبل 2)',
      role: UserRole.SALES,
      companyId: companyB.id,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        companyId: u.companyId,
        passwordHash,
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        companyId: u.companyId,
        passwordHash,
      },
    });
  }

  // Units for Company A (minor units: 100 = 1.00)
  const unitsA = [
    {
      id: 'unit_a_101',
      companyId: companyA.id,
      projectName: 'أبراج النخبة — الرياض',
      unitNumber: 'NK-101',
      type: 'شقة سكنية',
      area: 145.5,
      rooms: 3,
      price: 85_000_000n, // 850,000.00
    },
    {
      id: 'unit_a_102',
      companyId: companyA.id,
      projectName: 'أبراج النخبة — الرياض',
      unitNumber: 'NK-102',
      type: 'دوبلكس',
      area: 220.0,
      rooms: 5,
      price: 140_000_000n, // 1,400,000.00
    },
    {
      id: 'unit_a_103',
      companyId: companyA.id,
      projectName: 'حي الياسمين ريزيدنس',
      unitNumber: 'YS-201',
      type: 'فيلا تاون هاوس',
      area: 310.0,
      rooms: 6,
      price: 210_000_000n, // 2,100,000.00
    },
  ];

  // Units for Company B
  const unitsB = [
    {
      id: 'unit_b_101',
      companyId: companyB.id,
      projectName: 'مجمع المستقبل — جدة',
      unitNumber: 'MS-101',
      type: 'شقة بحرية',
      area: 160.0,
      rooms: 4,
      price: 92_000_000n,
    },
    {
      id: 'unit_b_102',
      companyId: companyB.id,
      projectName: 'مجمع المستقبل — جدة',
      unitNumber: 'MS-102',
      type: 'بنتهاوس',
      area: 280.0,
      rooms: 5,
      price: 185_000_000n,
    },
  ];

  for (const unit of [...unitsA, ...unitsB]) {
    await prisma.unit.upsert({
      where: {
        companyId_unitNumber: {
          companyId: unit.companyId,
          unitNumber: unit.unitNumber,
        },
      },
      update: {},
      create: {
        ...unit,
        status: UnitStatus.AVAILABLE,
      },
    });
  }

  // Clients (distinct per company and per agent)
  const clients = [
    {
      id: 'cli_a_1',
      companyId: companyA.id,
      agentId: 'usr_a_sales1',
      name: 'عبدالله الغامدي',
      phone: '0501234501',
      notes: 'مهتم بشقة في أبراج النخبة',
    },
    {
      id: 'cli_a_2',
      companyId: companyA.id,
      agentId: 'usr_a_sales2',
      name: 'منى المطيري',
      phone: '0501234502',
      notes: 'تبحث عن دوبلكس أو تاون هاوس',
    },
    {
      id: 'cli_b_1',
      companyId: companyB.id,
      agentId: 'usr_b_sales1',
      name: 'طارق باوزير',
      phone: '0559876501',
      notes: 'عميل شركة دار المستقبل — وحدة بحرية',
    },
    {
      id: 'cli_b_2',
      companyId: companyB.id,
      agentId: 'usr_b_sales2',
      name: 'هدى المالكي',
      phone: '0559876502',
      notes: 'عميلة شركة دار المستقبل — بنتهاوس',
    },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: client.id },
      update: {},
      create: client,
    });
  }

  // ─── 4. RESERVATIONS & CONTRACTS FOR TESTING ────────────────
  const expiresFuture = new Date(Date.now() + 72 * 60 * 60 * 1000);

  // Active reservation for Unit A-102 (allows testing contract drafting)
  await prisma.reservation.upsert({
    where: { id: 'res_seed_a_102' },
    update: {
      status: ReservationStatus.ACTIVE,
      expiresAt: expiresFuture,
    },
    create: {
      id: 'res_seed_a_102',
      companyId: companyA.id,
      unitId: 'unit_a_102',
      clientId: 'cli_a_2',
      agentId: 'usr_a_sales2',
      status: ReservationStatus.ACTIVE,
      expiresAt: expiresFuture,
    },
  });
  await prisma.unit.update({
    where: { id: 'unit_a_102' },
    data: { status: UnitStatus.RESERVED },
  });

  // Converted reservation for Unit A-101 (has approved contract & installments & payments)
  await prisma.reservation.upsert({
    where: { id: 'res_seed_a_101' },
    update: { status: ReservationStatus.CONVERTED },
    create: {
      id: 'res_seed_a_101',
      companyId: companyA.id,
      unitId: 'unit_a_101',
      clientId: 'cli_a_1',
      agentId: 'usr_a_sales1',
      status: ReservationStatus.CONVERTED,
      expiresAt: new Date('2026-02-04T10:00:00Z'),
    },
  });
  await prisma.unit.update({
    where: { id: 'unit_a_101' },
    data: { status: UnitStatus.SOLD },
  });

  // Approved Contract for Unit A-101
  // unitPrice: 850,000.00 (85_000_000), discount: 25,000.00 (2_500_000), finalPrice: 825,000.00 (82_500_000)
  // downPayment: 165,000.00 (16_500_000), remaining: 660,000.00 (66_000_000), 6 installments of 110,000.00 (11_000_000)
  const contractA101 = await prisma.contract.upsert({
    where: { id: 'cnt_seed_a_101' },
    update: {},
    create: {
      id: 'cnt_seed_a_101',
      companyId: companyA.id,
      reservationId: 'res_seed_a_101',
      unitId: 'unit_a_101',
      clientId: 'cli_a_1',
      createdById: 'usr_a_sales1',
      approvedById: 'usr_a_accountant',
      status: ContractStatus.APPROVED,
      unitPrice: 85_000_000n,
      discount: 2_500_000n,
      finalPrice: 82_500_000n,
      downPayment: 16_500_000n,
      remainingAmount: 66_000_000n,
      installmentCount: 6,
      startDate: new Date('2026-02-01'),
      approvedAt: new Date('2026-02-01T10:00:00Z'),
    },
  });

  // 6 Installments
  const installmentDefs = [
    { seq: 1, due: '2026-02-28', paid: 11_000_000n, status: InstallmentStatus.PAID },
    { seq: 2, due: '2026-03-31', paid: 5_000_000n, status: InstallmentStatus.PARTIAL },
    { seq: 3, due: '2026-04-30', paid: 0n, status: InstallmentStatus.PENDING },
    { seq: 4, due: '2026-05-31', paid: 0n, status: InstallmentStatus.PENDING },
    { seq: 5, due: '2026-06-30', paid: 0n, status: InstallmentStatus.PENDING },
    { seq: 6, due: '2026-07-31', paid: 0n, status: InstallmentStatus.PENDING },
  ];

  for (const def of installmentDefs) {
    const instId = `inst_seed_a_101_${def.seq}`;
    await prisma.installment.upsert({
      where: { id: instId },
      update: {},
      create: {
        id: instId,
        contractId: contractA101.id,
        sequenceNumber: def.seq,
        dueDate: new Date(def.due),
        amount: 11_000_000n,
        paidAmount: def.paid,
        status: def.status,
      },
    });
  }

  // Payment 160,000.00 (allocates 110,000 to Inst 1, 50,000 to Inst 2)
  const paymentA101 = await prisma.payment.upsert({
    where: {
      companyId_idempotencyKey: {
        companyId: companyA.id,
        idempotencyKey: 'seed-payment-init-001',
      },
    },
    update: {},
    create: {
      id: 'pay_seed_a_101_1',
      companyId: companyA.id,
      contractId: contractA101.id,
      recordedById: 'usr_a_accountant',
      amount: 16_000_000n,
      idempotencyKey: 'seed-payment-init-001',
      createdAt: new Date('2026-02-15T12:00:00Z'),
    },
  });

  await prisma.paymentAllocation.upsert({
    where: { id: 'alloc_seed_a_101_1' },
    update: {},
    create: {
      id: 'alloc_seed_a_101_1',
      paymentId: paymentA101.id,
      installmentId: 'inst_seed_a_101_1',
      amount: 11_000_000n,
    },
  });

  await prisma.paymentAllocation.upsert({
    where: { id: 'alloc_seed_a_101_2' },
    update: {},
    create: {
      id: 'alloc_seed_a_101_2',
      paymentId: paymentA101.id,
      installmentId: 'inst_seed_a_101_2',
      amount: 5_000_000n,
    },
  });

  // Draft Contract for Company B (allows Accountant to test contract approval)
  await prisma.reservation.upsert({
    where: { id: 'res_seed_b_101' },
    update: {
      status: ReservationStatus.ACTIVE,
      expiresAt: expiresFuture,
    },
    create: {
      id: 'res_seed_b_101',
      companyId: companyB.id,
      unitId: 'unit_b_101',
      clientId: 'cli_b_1',
      agentId: 'usr_b_sales1',
      status: ReservationStatus.ACTIVE,
      expiresAt: expiresFuture,
    },
  });
  await prisma.unit.update({
    where: { id: 'unit_b_101' },
    data: { status: UnitStatus.RESERVED },
  });

  await prisma.contract.upsert({
    where: { id: 'cnt_seed_b_101' },
    update: {},
    create: {
      id: 'cnt_seed_b_101',
      companyId: companyB.id,
      reservationId: 'res_seed_b_101',
      unitId: 'unit_b_101',
      clientId: 'cli_b_1',
      createdById: 'usr_b_sales1',
      status: ContractStatus.DRAFT,
      unitPrice: 92_000_000n,
      discount: 4_600_000n, // Exactly 5%
      finalPrice: 87_400_000n,
      downPayment: 17_400_000n,
      remainingAmount: 70_000_000n,
      installmentCount: 10,
      startDate: new Date('2026-03-01'),
    },
  });

  console.log('Seed completed successfully (2 companies, 8 users, 5 units, 4 clients, 2 reservations, 2 contracts, 1 payment).');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
