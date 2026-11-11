import { test, expect } from '@playwright/test';

const DEV_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'AqarElite!2026';

test.describe('Aqar Elite Full E2E Business & Security Workflow', () => {
  test('SALES reserves unit & drafts contract -> ACCOUNTANT approves & records FIFO payment', async ({
    page,
  }) => {
    // 1. Login as SALES agent (Company A)
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByLabel('البريد الإلكتروني').fill('sales1.a@nukhba.local');
    await page.getByLabel('كلمة المرور').fill(DEV_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page).toHaveURL(/\/units/);

    // Verify no auth tokens leaked into localStorage
    const localStorageKeys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(localStorageKeys).toEqual([]);

    // 2. Choose an AVAILABLE unit and reserve it for 72h
    const reserveBtn = page.getByRole('button', { name: /حجز الوحدة/ }).first();
    await expect(reserveBtn).toBeVisible();
    await reserveBtn.click();

    await page.getByRole('button', { name: 'تأكيد الحجز لمدة 72 ساعة' }).click();
    await expect(page.getByText(/تم حجز الوحدة/)).toBeVisible();

    // 3. Navigate to Reservations and draft contract
    await page.getByRole('link', { name: 'الحجوزات' }).click();
    await expect(page).toHaveURL(/\/reservations/);

    const draftBtn = page.getByRole('button', { name: 'إنشاء مسودة عقد' }).first();
    await expect(draftBtn).toBeVisible();
    await draftBtn.click();

    await page.getByLabel('قيمة الخصم (بحد أقصى 5% من السعر)').fill('0');
    await page.getByLabel('الدفعة الأولى').fill('50000');
    await page.getByLabel('عدد الأقساط').fill('4');
    await page.getByLabel('تاريخ بداية الأقساط').fill('2026-01-31');
    await page.getByRole('button', { name: 'حفظ مسودة العقد' }).click();

    await expect(page).toHaveURL(/\/contracts\/.+/);
    const contractUrl = page.url();

    // SALES must NOT see approve button
    await expect(page.getByRole('button', { name: 'اعتماد العقد' })).toHaveCount(0);

    // 4. Logout
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login/);

    // 5. Login as ACCOUNTANT (Company A)
    await page.getByLabel('البريد الإلكتروني').fill('accountant.a@nukhba.local');
    await page.getByLabel('كلمة المرور').fill(DEV_PASSWORD);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/units/);

    // 6. Open contract and approve
    await page.goto(contractUrl);
    await page.getByRole('button', { name: 'اعتماد العقد' }).click();
    await page.getByRole('button', { name: 'تأكيد الاعتماد النهائي' }).click();

    await expect(page.getByText('تم اعتماد العقد')).toBeVisible();
    await expect(page.getByText('مباعة')).toBeVisible();
    await expect(page.getByText('2026-02-28')).toBeVisible();

    // 7. Record payment and verify FIFO allocation
    await page.getByLabel(/مبلغ الدفعة/).fill('250000');
    await page.getByRole('button', { name: 'تسجيل الدفعة' }).click();
    await page.getByRole('button', { name: 'تأكيد التسجيل' }).click();

    await expect(page.getByText(/تم تسجيل الدفعة وتوزيعها على الأقساط الأقدم/)).toBeVisible();
    await expect(page.getByText(/قسط رقم #1/)).toBeVisible();
  });

  test('Responsive RTL check across 360px mobile and 1440px desktop without horizontal overflow', async ({
    page,
  }) => {
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/login');
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasOverflow).toBe(false);
    }
  });
});
