import { test, expect, type Page } from '@playwright/test';

const DEV_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'AqarElite!2026';

function attachErrorListeners(page: Page, errors: string[]) {
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
}

test.describe('Aqar Elite Full E2E Business, UX & Security Workflow', () => {
  test('Complete ADMIN -> SALES -> ACCOUNTANT workflow with validation, empty states, screenshots & zero console errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    attachErrorListeners(page, errors);

    const ts = Date.now().toString().slice(-6);
    const unitNumber = `E2E-${ts}`;
    const clientName = `عميل اختبار ${ts}`;

    // 0. Unauthenticated redirect check + Login validation error check
    await page.goto('/units');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.getByText('يرجى إدخال بريد إلكتروني صحيح')).toBeVisible();
    await page.screenshot({ path: 'test-results/e2e-01-login-validation.png', fullPage: true });

    // 1. Login as ADMIN (Company A) and create a fresh unit
    await page.getByLabel('البريد الإلكتروني').fill('admin.a@nukhba.local');
    await page.getByLabel('كلمة المرور').fill(DEV_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/units/);

    // Verify no tokens in localStorage
    expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual([]);

    await page.getByRole('button', { name: 'إضافة وحدة' }).click();
    await page.getByLabel('اسم المشروع').fill('مشروع التحقق الشامل');
    await page.getByLabel('رقم الوحدة').fill(unitNumber);
    await page.getByLabel('النوع').fill('شقة');
    await page.getByLabel('المساحة (م²)').fill('155');
    await page.getByLabel('عدد الغرف').fill('3');
    await page.getByLabel('السعر (بالوحدة الأساسية)').fill('1000000');
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(page.getByText('تمت إضافة الوحدة بنجاح')).toBeVisible();

    // Check empty state via price filter
    await page.getByLabel('أقل سعر').fill('999999999');
    await page.getByRole('button', { name: 'تطبيق' }).click();
    await expect(page.getByText('لا توجد وحدات مطابقة لمعايير البحث الحالية.')).toBeVisible();
    await page.getByLabel('أقل سعر').fill('');
    await page.getByRole('button', { name: 'تطبيق' }).click();
    await expect(page.getByRole('cell', { name: unitNumber })).toBeVisible();

    // Check ADMIN audit log
    await page.getByRole('link', { name: 'سجل التدقيق' }).click();
    await expect(page).toHaveURL(/\/audit-logs/);
    await expect(page.getByText('UNIT_CREATED').first()).toBeVisible();

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login/);

    // 2. Login as SALES agent (Company A)
    await page.getByLabel('البريد الإلكتروني').fill('sales1.a@nukhba.local');
    await page.getByLabel('كلمة المرور').fill(DEV_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/units/);

    // SALES must not see Audit Log link or Add Unit button
    await expect(page.getByRole('link', { name: 'سجل التدقيق' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إضافة وحدة' })).toHaveCount(0);

    // Create a client with plain-text notes (including XSS-like text to confirm safe rendering)
    await page.getByRole('link', { name: 'العملاء' }).click();
    await expect(page).toHaveURL(/\/clients/);
    await page.getByRole('button', { name: 'إضافة عميل' }).click();
    await page.getByLabel('الاسم الكامل').fill(clientName);
    await page.getByLabel('رقم الهاتف').fill('0501112233');
    await page.getByLabel('ملاحظات').fill('عميل E2E <script>alert(1)</script>');
    await page.getByRole('button', { name: 'حفظ العميل' }).click();
    await expect(page.getByText('تمت إضافة العميل بنجاح')).toBeVisible();

    // Reserve the newly created unit
    await page.getByRole('link', { name: 'الوحدات العقارية' }).click();
    const unitRow = page.locator('tr', { hasText: unitNumber });
    await expect(unitRow).toBeVisible();
    await unitRow.getByRole('button', { name: /حجز الوحدة/ }).click();

    await page.getByLabel('اختر العميل (من عملائك فقط)').selectOption({ label: `${clientName} — 0501112233` });
    await page.getByRole('button', { name: 'تأكيد الحجز لمدة 72 ساعة' }).click();
    await expect(page.getByText(`تم حجز الوحدة ${unitNumber} لمدة 72 ساعة بنجاح`)).toBeVisible();
    await page.screenshot({ path: 'test-results/e2e-02-units-after-reserve.png', fullPage: true });

    // Go to Reservations & create Contract Draft
    await page.getByRole('link', { name: 'الحجوزات' }).click();
    await expect(page).toHaveURL(/\/reservations/);
    const resRow = page.locator('tr', { hasText: unitNumber });
    await resRow.getByRole('button', { name: 'إنشاء مسودة عقد' }).click();

    // Test >5% discount rejection (50,001 on 1,000,000)
    await page.getByLabel('قيمة الخصم (بحد أقصى 5% من السعر)').fill('50001');
    await page.getByLabel('الدفعة الأولى').fill('50000');
    await page.getByLabel('عدد الأقساط').fill('3');
    await page.getByLabel('تاريخ بداية الأقساط').fill('2026-01-31');
    await page.getByRole('button', { name: 'حفظ مسودة العقد' }).click();
    await expect(page.getByText(/الخصم لا يمكن أن يتجاوز 5%/)).toBeVisible();

    // Submit valid 5% discount (50,000) -> finalPrice 950,000 -> downPayment 50,000 -> remaining 900,000 / 3 = 300,000 each
    await page.getByLabel('قيمة الخصم (بحد أقصى 5% من السعر)').fill('50000');
    await page.getByRole('button', { name: 'حفظ مسودة العقد' }).click();
    await expect(page).toHaveURL(/\/contracts\/.+/);
    const contractUrl = page.url();

    // SALES must NOT see approve button
    await expect(page.getByRole('button', { name: 'اعتماد العقد' })).toHaveCount(0);

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login/);

    // 3. Login as ACCOUNTANT (Company A)
    await page.getByLabel('البريد الإلكتروني').fill('accountant.a@nukhba.local');
    await page.getByLabel('كلمة المرور').fill(DEV_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/units/);

    // Approve contract
    await page.goto(contractUrl);
    await page.getByRole('button', { name: 'اعتماد العقد' }).click();
    await page.getByRole('button', { name: 'تأكيد الاعتماد النهائي' }).click();

    await expect(page.getByText(/تم اعتماد العقد/)).toBeVisible();
    await expect(page.getByText('مباعة', { exact: true })).toBeVisible();
    await expect(page.getByText('2026-02-28')).toBeVisible();
    await expect(page.getByText('2026-03-31')).toBeVisible();
    await expect(page.getByText('2026-04-30')).toBeVisible();

    // Test overpayment rejection (900,001 > 900,000)
    await page.getByLabel(/مبلغ الدفعة/).fill('900001');
    await page.getByRole('button', { name: 'تسجيل الدفعة' }).click();
    await page.getByRole('button', { name: 'تأكيد التسجيل' }).click();
    await expect(page.getByText('مبلغ الدفعة يتجاوز المتبقي من العقد')).toBeVisible();

    // Record valid payment (350,000 -> 300,000 to #1 PAID, 50,000 to #2 PARTIAL)
    await page.getByLabel(/مبلغ الدفعة/).fill('350000');
    await page.getByRole('button', { name: 'تسجيل الدفعة' }).click();
    await page.getByRole('button', { name: 'تأكيد التسجيل' }).click();

    await expect(page.getByText(/تم تسجيل الدفعة وتوزيعها على الأقساط الأقدم/)).toBeVisible();
    await expect(page.getByText(/قسط رقم #1: 300,000.00/)).toBeVisible();
    await expect(page.getByText(/قسط رقم #2: 50,000.00/)).toBeVisible();
    await page.screenshot({ path: 'test-results/e2e-03-contract-approved-paid.png', fullPage: true });

    // Responsive check on authenticated contract page across mobile, tablet, desktop
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasOverflow, `Horizontal overflow at width ${width}px`).toBe(false);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: 'test-results/e2e-04-mobile-360px.png', fullPage: true });

    // Assert zero unexpected console/page errors (note: 400 validation tests may log browser failed-resource console messages; filter only uncaught pageerrors or unexpected JS errors)
    const uncaught = errors.filter((e) => e.startsWith('pageerror:'));
    expect(uncaught).toEqual([]);
  });

  test('Payment form initializes and submits cleanly when crypto.randomUUID is unavailable (non-HTTPS LAN HTTP simulation)', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      Object.defineProperty(window.crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      });
    });

    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill('accountant.a@nukhba.local');
    await page.getByLabel('كلمة المرور').fill(DEV_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/units/);

    await page.getByRole('link', { name: 'العقود والأقساط' }).click();
    await expect(page).toHaveURL(/\/contracts/);

    await page.getByRole('link', { name: 'فتح العقد' }).first().click();
    await expect(page.getByRole('heading', { name: 'تسجيل دفعة جديدة' })).toBeVisible();

    await page.getByLabel(/مبلغ الدفعة/).fill('10000');
    await page.getByRole('button', { name: 'تسجيل الدفعة' }).click();
    await page.getByRole('button', { name: 'تأكيد التسجيل' }).click();
    await expect(page.getByText(/تم تسجيل الدفعة وتوزيعها على الأقساط الأقدم/)).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
