# PHASE 2 — Tenant Isolation, Units, Clients & Reservations

## Sprint 2.1 — Tenant Isolation Foundation
اجعل tenant context يُستخرج حصراً من الجلسة الموثوقة على الخادم.
كل Repository/Service query يجب أن يستقبل Tenant Context موثوقاً أو يستخدم آلية مركزية تمنع نسيان company scope.
لا تجعل companyId اختيارياً في عمليات بيانات الشركات.
تحقق من ownership للـ Unit/Client/Reservation/Contract قبل كل عملية.
امنع mass assignment: استخدم DTO schemas تسمح بالحقول المسموح بها فقط.

اختبر IDOR باستخدام IDs صحيحة تخص الشركة الأخرى، وتأكد من عدم تسريب بيانات أو اختلافات رسائل تكشف وجود المورد.

## Sprint 2.2 — Units
المطلوب:
- المدير يضيف ويعدل الوحدة.
- الحقول: project name (نص)، unit number، type، area، rooms، price.
- الحالات: available / reserved / sold.
- server-side filtering حسب status وprice range.
- pagination من الخادم.
- sorting مسموح به فقط حسب price أو area مع allowlist.
- لا تعديل سعر وحدة reserved أو sold.
- كل تغيير سعر يسجل في AuditLog.
- لا تسمح بتغيير status مباشرة من endpoint عام؛ الانتقالات عبر عمليات المجال فقط.

اكتب اختبارات:
- valid/invalid unit.
- pagination boundaries.
- invalid sort field/direction.
- company isolation.
- role restrictions.
- price edit restrictions.
- audit event creation.

## Sprint 2.3 — Clients
المندوب يضيف عميلاً بالحقول:
- name
- phone
- free-text notes

المندوب يرى عملاءه فقط. تحقق من ذلك في الخادم وليس UI.
المدير والمحاسب وفق صلاحيات المستند؛ لا تسمح للمحاسب بتعديل بيانات العميل.
اعرض notes في صفحة العميل لاحقاً، لكن الآن اختبر CRUD/authorization في service/API.
نظّف وعالج النصوص بأمان عند العرض، ولا تستخدم HTML خاماً غير موثوق.

## Sprint 2.4 — Reservations (Critical)
- الحجز لمدة 72 ساعة.
- عند الانتهاء تعود الوحدة available دون تدخل يدوي.
- مندوبان يحاولان حجز الوحدة نفسها في الوقت نفسه: واحد فقط ينجح.
- رفض الحجز برسالة واضحة إذا لم تعد الوحدة متاحة.
- تغيير Unit إلى reserved وإنشاء Reservation داخل transaction واحدة.
- لا تعتمد على فحص availability في التطبيق فقط؛ استخدم atomic DB operation/locking.
- صمم expiry worker/scheduler مناسباً للبيئة، مع lazy expiration قبل العمليات الحرجة كطبقة حماية إضافية.
- اجعل عملية expiration idempotent وآمنة عند تكرار تشغيلها.
- لا تنفذ worker يعتمد على ذاكرة process فقط إذا كان ذلك لا يضمن التشغيل بعد restart.
- اختبر باستخدام PostgreSQL حقيقي وعمليات متزامنة متوازية.

## QA Engineer — Phase 2 Gate
اختبر على الأقل:
1. شركة A لا ترى Unit أو Client أو Reservation لشركة B.
2. Sales Agent A لا يرى عملاء Agent B داخل نفس الشركة.
3. المحاسب لا يعدل Client أو Unit.
4. المدير فقط يضيف/يعدل وحدات.
5. Sorting/filtering/pagination لا تسمح injection أو bypass.
6. تغيير سعر وحدة متاحة يكتب AuditLog.
7. تغيير سعر reserved/sold مرفوض.
8. 10 محاولات متزامنة لحجز وحدة واحدة: نجاح واحد فقط.
9. لا توجد Reservation مكررة نشطة للوحدة.
10. انتهاء 72 ساعة يعيد الوحدة available.
11. تكرار expiry job لا يفسد الحالة.
12. حجز وحدة لشركة أخرى مرفوض.
13. فشل إنشاء Reservation لا يترك Unit في reserved بلا Reservation.

### Quality Gate
لا تنتقل إلى العقود حتى تنجح اختبارات التزامن والعزل والملكية على PostgreSQL فعلي، وليس mocks فقط.
