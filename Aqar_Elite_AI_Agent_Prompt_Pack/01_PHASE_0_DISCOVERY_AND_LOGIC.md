# PHASE 0 — Discovery, Requirements & Domain Logic First

## الهدف
فهم التكليف وتحويله إلى مواصفات قابلة للاختبار قبل بناء أي واجهة أو تنفيذ features.
هذه المرحلة تمنع كتابة كود عشوائي أو افتراض قواعد مالية وأمنية دون توثيق.

## Sprint 0.1 — Repository & Requirement Audit
افحص:
- هيكل المشروع الحالي وحالة Git.
- Node.js وpackage manager والـ lockfile.
- Next.js / TypeScript / ORM الموجودة وإصداراتها.
- الملفات والاعتماديات غير المستخدمة إن وجدت.
- ملفات PDF أو المواصفات المتاحة في المشروع.
- هل المشروع جديد أم قائم؟ لا تحذف شيئاً.

أنشئ:
- `docs/REQUIREMENTS_TRACEABILITY.md`
- `docs/ASSUMPTIONS.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/THREAT_MODEL.md`
- `docs/DOMAIN_RULES.md`
- `docs/TEST_STRATEGY.md`

في Requirements Traceability ضع كل بند من التكليف مع رقم الصفحة، التصنيف (Mandatory/Optional/Out of Scope)، ومكان تنفيذه واختباره.

## Sprint 0.2 — Domain Model & State Machines
وثّق الكيانات المطلوبة:
Unit, Client, Reservation, Contract, Installment, Payment, AuditLog.
يمكن إضافة كيانات مساندة مبررة مثل Company, User, Session, PaymentAllocation، دون تضخيم.

وثّق العلاقات والملكية والـ tenant boundaries.
وثّق state machines:

Unit:
- available -> reserved عند الحجز.
- reserved -> available عند انتهاء الحجز.
- reserved -> sold عند اعتماد العقد.
- لا تسمح بأي انتقال آخر.

Reservation:
- active / expired / converted أو حالات واضحة مكافئة.
- مدة الحجز 72 ساعة بالضبط.
- لا يوجد تمديد أو إلغاء يدوي إلا إذا كان مطلوباً؛ لا تضف ذلك.

Contract:
- draft -> approved فقط.
- بعد approved يصبح immutable.

Installment:
- pending / partial / paid / overdue.
- overdue حالة مشتقة من تاريخ الاستحقاق والرصيد غير المسدد، أو يتم تحديثها بآلية موثوقة موثقة.
- لا تجعل الحالة المتأخرة تطغى على paid.

Payment:
- append-only؛ لا تعديل ولا حذف.
- كل Payment له allocations قابلة للتتبع.

## Sprint 0.3 — Financial Rules Specification
صمم واكتب أمثلة اختبارية قبل الكود:
- الخصم لا يتجاوز 5% من سعر الوحدة.
- السعر النهائي = سعر الوحدة - الخصم.
- الدفعة الأولى لا تتجاوز السعر النهائي ولا تكون سالبة.
- المتبقي = السعر النهائي - الدفعة الأولى.
- مجموع الأقساط = المتبقي بالضبط حتى أصغر وحدة نقدية.
- ممنوع float/decimal JS number في الحسابات المالية.
- اختر تمثيل minor units كـ BigInt في domain/database، وناقش serialization إلى JSON كسلسلة رقمية أو تمثيل آمن.
- توزيع فرق القسمة على الأقساط بطريقة deterministic موثقة.
- توزيع الدفعات على أقدم الأقساط غير المسددة أولاً.
- رفض الدفع الذي يتجاوز المتبقي من العقد.
- Idempotency يمنع إنشاء دفعتين لنفس الطلب.

### قرار تاريخ 31 يناير
المستند يطلب اختيار منطق وتوثيقه ولا يفرض سياسة بعينها.
اختر سياسة واضحة واكتب اختبارات لها. التوصية: monthly anniversary مع clamping إلى آخر يوم في الشهر، مع تثبيت يوم الأساس الأصلي حتى لا يتراكم الانزياح: عقد يبدأ 31 يناير -> 28/29 فبراير -> 31 مارس -> 30 أبريل. وثّقها كافتراض، وغطِّ السنوات الكبيسة والمنطقة الزمنية.

## Sprint 0.4 — Concurrency & Security Design
صمم آلية تمنع حجز الوحدة مرتين في الوقت نفسه:
- atomic conditional update أو row-level lock.
- إنشاء Reservation وتغيير Unit في transaction واحدة.
- قيد قاعدة بيانات/استراتيجية تمنع وجود أكثر من حجز نشط للوحدة.
- اختبارات متزامنة حقيقية على PostgreSQL، لا mocks فقط.

صمم Tenant Isolation:
- companyId يأتي من session server-side فقط.
- جميع الاستعلامات مقيدة بالشركة.
- تحقق ownership للموارد المرتبطة.
- لا تثق بمعرفات company/user/role المرسلة من العميل.
- فكر في IDOR وmass assignment وrole escalation.

## Sprint 0.5 — Test-First Domain Proof
قبل UI، أنشئ اختباراً أو pseudocode قابل للتحويل لاختبار فعلي لكل قاعدة:
- installment generation / rounding.
- payment allocation order.
- overpayment rejection.
- discount cap.
- end-of-month dates.
- reservation concurrency.
- tenant isolation.
- immutable approved contract.
- payment idempotency.

لا تبنِ UI في هذه المرحلة.

## QA Engineer — Phase 0 Independent Gate
أنت الآن QA Engineer مستقل. لا تفترض صحة تحليل المطور.
راجع PDF مقابل Requirements Traceability وتحقق من عدم إسقاط أي مطلب.
حاول اكتشاف:
- تعارضات أو ثغرات في حالات Unit/Reservation/Contract.
- سيناريوهات دفعات جزئية ومتعددة.
- عقد يبدأ يوم 29/30/31.
- دفعة متزامنة لنفس العقد.
- شركة تحاول تخمين ID لشركة أخرى.
- موظف يرسل companyId أو role مختلفاً في body.
- حجز ينتهي أثناء محاولة إنشاء عقد.
- فشل transaction في منتصف العملية.

### Quality Gate
PASS فقط إذا:
1. كل متطلبات PDF ممثلة في Traceability.
2. كل الغموض موثق كافتراض، وليس مخفياً.
3. منطق المال والتواريخ والحجز محدد بأمثلة.
4. Threat Model وTest Strategy موجودان.
5. QA لا يجد فجوة حرجة غير محسومة.

إذا فشل أي شرط، أصلح الوثائق/التصميم وأعد QA. لا تبدأ Phase 1 قبل PASS.
