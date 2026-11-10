# PHASE 5 — Independent Security Review, Integration & E2E

## Sprint 5.1 — Security Threat Review
قم بمراجعة النظام كما لو أنك مهاجم لديه حساب صالح.
أنشئ/حدّث `docs/SECURITY_REVIEW.md`.
راجع:
- Authentication/session lifecycle.
- brute-force/rate limit.
- CSRF.
- IDOR.
- tenant isolation.
- role escalation.
- mass assignment.
- input validation.
- SQL injection.
- XSS من notes وأي نص حر.
- security headers.
- secret leakage في Git/build/client bundle/logs.
- dependency vulnerabilities.
- payment replay/idempotency.
- concurrency/transaction integrity.
- audit log tampering أو الوصول غير المصرح.
لا تدّعِ أن النظام آمن بشكل مطلق؛ اذكر حدود الحماية والمخاطر المتبقية.

## Sprint 5.2 — Integration Tests
اختبارات على PostgreSQL فعلي:
- Tenant isolation بين شركتين.
- Authorization حسب الأدوار.
- reservation concurrency.
- contract approval transaction.
- payment transaction and allocation.
- idempotency.
- constraints and foreign keys.
- expiry job behavior.

لا تعتمد على SQLite إذا كان سلوك PostgreSQL/locking/constraints هو ما نختبره.

## Sprint 5.3 — Playwright E2E
أنشئ اختبار E2E واحداً على الأقل للمسار المطلوب في التكليف:
1. تسجيل الدخول كمندوب.
2. اختيار وحدة متاحة.
3. حجزها لعميل.
4. إنشاء عقد مسودة من الحجز النشط.
5. تسجيل الخروج.
6. الدخول كمحاسب.
7. اعتماد العقد.
8. التأكد من تحول الوحدة إلى sold وظهور جدول الأقساط.
9. تسجيل دفعة.
10. التأكد من توزيعها على الأقساط وتحديث المتبقي.

أضف حالات E2E أمنية/صلاحيات عند الإمكان، ولا تجعل الاختبار يعتمد على ترتيب بيانات هش.

استخدم مهارة Playwright المناسبة المتاحة في بيئة الوكيل. لا تخلط عدة أدوات Playwright بلا داعٍ؛ اختر مساراً واحداً للاختبارات الآلية الرسمية، ويمكن استخدام browser skill إضافي للاستكشاف البصري فقط.

## Sprint 5.4 — Full Regression
شغل:
- unit tests.
- integration tests.
- E2E.
- lint.
- typecheck.
- build.
- dependency audit.
راجع التغطية للمنطق الحرج، لا تطارد نسبة coverage شكلية.

## QA Engineer — Phase 5 Gate
QA مستقل ينفذ checklist الهجومي دون الاعتماد على ملاحظات المطور:
- مستخدم من الشركة A يحاول الوصول إلى كل نوع resource في الشركة B.
- مندوب يحاول اعتماد عقد/تسجيل دفعة/تعديل سعر.
- محاسب يحاول تعديل عميل أو وحدة/حذف دفعة.
- مستخدم يرسل role/companyId/ownerId مزوراً.
- replay لطلب الدفع.
- إرسال طلبات متزامنة للحجز والدفع.
- XSS payload في notes.
- قيم فلترة وترتيب غير صالحة.
- session قديمة بعد logout.
- secret scanning وdependency audit.
سجل كل finding بدرجة severity وخطوات إعادة الإنتاج.
لا تغلق finding إلا بعد إعادة الاختبار.

### Quality Gate
لا يوجد Critical أو High مفتوح. جميع متطلبات الأمان الإلزامية مغطاة باختبار أو دليل مراجعة واضح. كل regression ناجح.
