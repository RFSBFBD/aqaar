# PHASE 6 — Docker, CI, Documentation & Submission

## Sprint 6.1 — Docker Compose
يجب أن يعمل المشروع على جهاز نظيف عبر:
`git clone <private-repository-url>`
`docker compose up`

جهز:
- app service.
- PostgreSQL service.
- healthchecks.
- persistent database volume.
- environment variables.
- startup ordering لا يعتمد على مجرد depends_on دون readiness.
- migrations تُنفذ بطريقة آمنة وموثقة.
- seed command منفصل أو موضح.
- لا تضع أسراراً حقيقية في compose أو Git.
اختبر من clean state ومن حالة وجود volume سابق.

## Sprint 6.2 — CI
أنشئ GitHub Actions workflow يشغل:
- install من lockfile.
- lint.
- typecheck.
- unit tests.
- integration tests إذا أمكن مع PostgreSQL service.
- build.
لا تضع أسراراً غير لازمة في CI.
اجعل الفشل يمنع اعتبار الـ pipeline ناجحاً.

## Sprint 6.3 — README
يجب أن يحتوي README على:
1. وصف مختصر للنظام.
2. Stack والقرارات التقنية ولماذا.
3. متطلبات التشغيل.
4. خطوات التشغيل من جهاز نظيف.
5. Docker Compose.
6. Migrations وSeed.
7. حسابات الاختبار لكل شركة ودور (بيانات محلية آمنة).
8. شرح Tenant Isolation: companyId من session server-side وكيف تُقيد الاستعلامات.
9. شرح الصلاحيات.
10. الافتراضات وقواعد العمل الغامضة.
11. منطق الأقساط والدفعات وتواريخ الاستحقاق.
12. أهم 3 مخاطر أمنية وكيف عولجت.
13. الاختبارات والأوامر ونتائجها.
14. ما لم ينجز وكيف سيتم إنجازه.
15. أين استُخدمت أدوات AI، مع توضيح أن المرشح راجع الكود ويفهمه.

## Sprint 6.4 — Git Hygiene
راجع:
- commits صغيرة ومعبرة.
- لا commit ضخم واحد.
- `.gitignore` صحيح.
- لا `.env` أو secrets في history.
- لا build artifacts غير لازمة.
- لا dependencies غير مستخدمة.
- لا dead code أو debug logs.
- لا ملفات generated غير لازمة.
- package lock متزامن مع package.json.

## QA Engineer — Phase 6 Gate
نفذ حرفياً من بيئة نظيفة:
1. clone repository.
2. تحقق من عدم الحاجة لملفات محلية غير موثقة.
3. `docker compose up`.
4. تحقق من health/readiness.
5. نفذ login بحسابات seed.
6. نفذ المسار الرئيسي end-to-end.
7. شغل CI commands.
8. افحص README مقابل الواقع.
9. افحص Git history وsecret leakage.
10. تحقق من أن `npm audit` لا يحتوي High/Critical غير معالج أو موثق باستثناء مبرر ومقبول.

### Quality Gate
التسليم BLOCKED إذا لم يعمل clean clone + docker compose up، أو كانت تعليمات README غير صحيحة، أو بقيت ثغرة عالية/حرجة.
