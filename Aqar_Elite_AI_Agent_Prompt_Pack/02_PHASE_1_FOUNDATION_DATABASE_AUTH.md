# PHASE 1 — Project Foundation, PostgreSQL & Authentication

## Sprint 1.1 — Project Foundation
أنشئ/نظّم Next.js App Router + TypeScript strict وفق نتيجة Phase 0.
تحقق من أحدث Stable متوافق لكل dependency من npm registry والمصادر الرسمية قبل تثبيتها.
سجل exact versions ولا تستخدم prerelease دون مبرر.
جهز scripts واضحة: dev, build, lint, typecheck, test, test:integration, db:migrate, db:seed.
أنشئ بنية طبقات واضحة، مثلاً:
- `src/app` للصفحات وRoute Handlers.
- `src/server/auth`
- `src/server/services`
- `src/server/repositories`
- `src/server/validation`
- `src/domain`
- `src/lib`
- `prisma`
لا تنشئ مجلدات فارغة أو طبقات لا تستخدم.

## Sprint 1.2 — PostgreSQL & Schema
صمم Prisma schema وفق Domain Model.
يجب تضمين:
- Company
- User
- Session (إذا اخترت database-backed sessions)
- Unit
- Client
- Reservation
- Contract
- Installment
- Payment
- PaymentAllocation
- AuditLog

أضف:
- companyId حيث يلزم.
- علاقات Foreign Keys صحيحة.
- Unique constraints مناسبة، مثل email uniqueness، ورقم الوحدة داخل الشركة.
- Check constraints في PostgreSQL للقيم الموجبة والنطاقات المالية والحالات حيث أمكن.
- Indexes لاستعلامات الشركة والحالة والتواريخ.
- قيود تمنع duplicate idempotency keys ضمن النطاق الصحيح.
- سياسة حذف Restrict/No Action للسجلات المالية والتاريخية.

لا تعتمد على validation في TypeScript فقط؛ قيود سلامة البيانات يجب أن توجد في قاعدة البيانات أيضاً.
أنشئ migration حقيقية، لا تستخدم db push كبديل للتسليم.

## Sprint 1.3 — Seed
أنشئ Seed قابل لإعادة التشغيل بأمان:
- شركتان.
- كل شركة: مدير، محاسب، مندوبان.
- وحدات وعملاء تجريبيون.
- بيانات لا تكشف كلمات مرور حقيقية.
- كلمات مرور seed موثقة محلياً فقط وبطريقة مناسبة، ولا تستخدمها في الإنتاج.
تأكد أن بيانات الشركتين مختلفة بما يكفي لاختبار العزل.

## Sprint 1.4 — Authentication & Sessions
نفّذ login/logout فقط:
- لا signup.
- لا إدارة مستخدمين.
- Password hash Argon2id أو bcrypt.
- Session cookie HttpOnly، Secure في production، SameSite مناسب، Path مناسب.
- لا tokens في localStorage.
- تخزين session آمن؛ يفضل hash للـ session token في DB.
- انتهاء صلاحية الجلسة.
- Logout يبطل session في الخادم فعلياً.
- رسائل login موحدة لا تكشف هل البريد موجود.
- rate limiting لمحاولات الدخول مع مراعاة التخزين المشترك في production.
- حماية CSRF حسب نمط الطلبات.
- لا تسجل password أو token.

## Sprint 1.5 — AuthZ Primitives
نفذ server-only helpers:
- `getCurrentSession()`
- `requireAuthenticatedUser()`
- `requireRole(...)`
- `getTenantContext()` أو ما يعادله.
لا تقبل companyId من request لتحديد tenant.
صمم typed errors ورسائل آمنة.

## QA Engineer — Phase 1 Gate
اختبر بصورة مستقلة:
- migration من قاعدة فارغة.
- seed مرتين دون تكرار/فساد.
- login صحيح وخاطئ ورسالة موحدة.
- password hash لا يظهر في API أو logs.
- cookie attributes في production configuration.
- logout يبطل session حتى لو أعيد إرسال cookie القديمة.
- expired/revoked session مرفوضة.
- rate limiting.
- لا يوجد signup أو user management routes.
- محاولة تعديل role/companyId من request لا تغير الصلاحية.
- lint + typecheck + unit tests + integration tests.

### Quality Gate
لا تنتقل إلى Phase 2 إلا بعد نجاح كل الاختبارات، ومراجعة schema والمigrations، وتوثيق نتائج QA.
