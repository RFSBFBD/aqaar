# PHASE 3 — Contracts, Installments & Payments

هذه المرحلة مالية وحرجة. ابدأ بالاختبارات الحسابية قبل كتابة الخدمات.

## Sprint 3.1 — Financial Domain Tests First
اكتب اختبارات مستقلة لخدمات pure domain:
- discount cap 5%.
- final price.
- down payment bounds.
- remaining amount.
- installment count validation.
- exact installment sum.
- deterministic remainder distribution.
- end-of-month due dates.
- payment allocation order.
- partial/paid/overdue statuses.
- overpayment rejection.
- idempotency.
لا تستخدم float أو JS number لتمثيل المبالغ.

استخدم integer minor units (BigInt أو تمثيل صحيح مكافئ). لا تمرر BigInt مباشرة في JSON؛ حوّله إلى decimal string عند حدود API. لا تحوّله إلى Number إذا كان ذلك قد يفقد الدقة.

## Sprint 3.2 — Contract Draft
المندوب ينشئ Draft Contract من Reservation نشط تابع لنفس الشركة وله صلاحية.
- لا يسمح بإنشاء عقد من حجز منتهي أو لوحدة لم تعد reserved.
- final price لا يقل عن 95% من سعر الوحدة.
- السعر النهائي لا يتجاوز سعر الوحدة.
- down payment بين صفر والسعر النهائي.
- لا تقبل حقولاً غير مسموح بها مثل companyId أو approvedBy من العميل.
- تحقق من ownership والـ tenant في الخادم.

## Sprint 3.3 — Contract Approval
المحاسب فقط يعتمد العقد.
الاعتماد يجب أن يكون transaction واحدة:
- تحقق من أن العقد Draft.
- تحقق من أن الحجز ما زال صالحاً والوحدة ما زالت reserved.
- أنشئ جدول الأقساط.
- غيّر حالة العقد إلى approved.
- غيّر الوحدة إلى sold.
- سجّل AuditLog.
إذا فشل أي جزء، rollback كامل.
بعد الاعتماد العقد immutable؛ أي محاولة تعديل مرفوضة من service/DB policy المناسبة.
لا تسمح باعتماد العقد مرتين.

## Sprint 3.4 — Installment Generation
أنشئ schedule شهرياً:
- remaining = final price - down payment.
- قسم remaining على عدد الأقساط.
- وزع remainder بطريقة deterministic على الأقساط الأولى أو حسب السياسة الموثقة.
- مجموع الأقساط يساوي remaining بالضبط.
- كل dueDate وفق سياسة 31 يناير الموثقة في Phase 0.
- صفحة العقد لاحقاً تعرض الجدول والحالة والمبلغ المتبقي.

## Sprint 3.5 — Payments & Allocation
المحاسب فقط يسجل Payment.
- المبلغ موجب.
- لا يتجاوز إجمالي المتبقي من العقد.
- وزّع على أقدم الأقساط غير المسددة أولاً.
- partial إذا دفع جزء، paid إذا اكتمل.
- overdue إذا حل تاريخ الاستحقاق وبقي مبلغ غير مدفوع.
- لا تحذف ولا تعدل Payment.
- أنشئ Payment + allocations + تحديث installment balances داخل transaction واحدة.
- Idempotency key إلزامي؛ تكرار نفس الطلب يعيد نتيجة العملية السابقة ولا ينشئ دفعة ثانية.
- عالج سباق تسجيل دفعتين متزامنتين للعقد نفسه بقفل/تحديث ذري مناسب حتى لا يتجاوز الإجمالي المستحق.

## QA Engineer — Phase 3 Gate
اختبر:
- خصم 5% مقبول و5.01% مرفوض.
- مبالغ صفرية وسالبة ومبالغ خارج الحدود.
- تقسيم 100000 minor units على 3 أقساط = مجموع دقيق.
- down payment + installments = final price بالضبط.
- 31 يناير، 29 فبراير، 30/31 مارس، leap year.
- حجز منتهي لا ينتج عقداً.
- مندوب لا يعتمد عقداً.
- المحاسب يستطيع الاعتماد، والمندوب لا يستطيع.
- الاعتماد المكرر لا ينشئ installments مكررة.
- فشل transaction لا يترك Unit sold دون عقد approved أو العكس.
- payment allocation على الأقساط الأقدم أولاً.
- partial ثم paid.
- overdue لا يطبق على قسط مدفوع.
- overpayment مرفوض.
- إعادة نفس idempotency key لا تنشئ دفعة ثانية.
- طلبا دفع متزامنان لا يتجاوزان المتبقي.
- Payment لا يقبل update/delete.
- عزل شركة A عن عقود/دفعات شركة B.

### Quality Gate
أي خطأ في مجموع المبالغ أو تكرار دفعة أو اعتماد جزئي = BLOCKER. أصلح وأعد جميع الاختبارات قبل الانتقال.
