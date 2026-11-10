# PHASE 4 — Arabic RTL Frontend & Human-Centered UX

## شرط البدء
لا تبدأ هذه المرحلة إلا بعد اجتياز اختبارات المنطق الحرجة في Phase 0–3.
الواجهة لا تعوض Backend غير صحيح.

## Sprint 4.1 — Visual Direction Before Components
تصرف كـ Product Designer محترف. ادرس سياق نظام إدارة عقارات وتقسيط، وحدد:
- المستخدمين: مدير شركة، مندوب مبيعات، محاسب.
- أهم المهام لكل دور.
- Navigation hierarchy.
- design tokens: palette محدودة 4–6 ألوان مع HEX، typography عربية، spacing scale، radii، borders، shadows.
- حالات البيانات والتفاعل.
- صفحة/شاشة مرجعية لكل workflow.
أنشئ `docs/UI_DIRECTION.md` قبل بناء المكونات.

ممنوع:
- استخدام اللون البنفسجي أو الأزرق الافتراضي لمجرد أن المكتبة تستخدمه.
- نسخ Dashboard template جاهز.
- gradients عشوائية أو glassmorphism بلا سبب.
- جعل كل عنصر Card.
- استخدام emoji بدلاً من icon system.
- استخدام نفس الـ spacing عشوائياً أو وضع كل شيء في منتصف الشاشة.
- حشو الواجهة بعناصر لا تدعم مهمة المستخدم.

## Sprint 4.2 — Design System & Shell
تحقق من أحدث stable متوافق لمكتبات UI/icon/font قبل الإضافة.
اختر مكتبة أيقونات SVG واحدة فقط عند الحاجة (مثلاً Lucide) واستخدم icons ذات معنى ثابت.
نفذ:
- RTL document direction.
- Layout responsive.
- Sidebar/navigation مناسب للشاشات.
- Header وسياق المستخدم والدور.
- Typography scale وline-height.
- spacing tokens.
- focus/hover/disabled states.
- semantic HTML وaccessible labels.
لا تكرر مكونات بلا حاجة ولا تنشئ design system ضخم.

## Sprint 4.3 — Functional Screens
نفذ الواجهات المرتبطة بالمتطلبات فقط:
- Login.
- Units list + filters + pagination + add/edit حسب الدور.
- Client list/detail + notes للمندوب.
- Reservation action + expiry indication.
- Contract draft/detail + approval للمحاسب.
- Installment schedule.
- Payment entry + allocation result.
- Audit log read-only للمدير.

كل شاشة تتصل بالـ API الحقيقي. لا تضع mock data في production UI.
لا تعرض actions لا يملك المستخدم صلاحيتها، مع العلم أن الحماية الحقيقية في الخادم.

## Sprint 4.4 — UX States & Form Quality
كل شاشة تتعامل مع:
- Loading.
- Empty.
- Error.
- Success.
- Disabled.
- Validation errors بجوار الحقول.
- Confirmation للعمليات ذات الأثر المالي/الحالتي.
- منع double-submit بصرياً، مع الاعتماد على idempotency في الخادم.
- رسائل عربية موجزة توضّح ما حدث وما يمكن فعله.
- لا تعرض stack traces أو تفاصيل داخلية.

راجع:
- line-height وline wrapping للنص العربي.
- مسافات الحقول والعناوين.
- ترتيب Tab وkeyboard.
- contrast.
- touch targets على الهاتف.
- عدم قص الجداول أو جعلها غير قابلة للاستخدام على الهاتف.

## Sprint 4.5 — Visual QA & Refinement
افحص الشاشات على الأقل عند:
- 360px mobile.
- 390px mobile.
- 768px tablet.
- 1280px desktop.
- 1440px desktop.

التقط Screenshots وقارن التناسق.
لا تضف animation إلا إذا كانت تخدم feedback أو توضح انتقالاً.
راجع الأيقونات: الحجم والمحاذاة والمعنى والاتساق.

## QA Engineer — Phase 4 Gate
اختبر من المتصفح:
- RTL صحيح في كل الصفحات والمكونات.
- Responsive layouts بلا overflow أفقي غير مقصود.
- كل زر ينفذ وظيفة حقيقية.
- لا يوجد dead links أو أزرار شكلية.
- رسائل التحقق بجوار الحقول.
- loading/empty/error/success موجودة.
- الصلاحيات المعروضة تتطابق مع الدور، والخادم يرفض العمليات الممنوعة.
- الجداول والنماذج قابلة للاستخدام على الهاتف.
- keyboard navigation وfocus visible.
- console بلا أخطاء جديدة.
- لا توجد صور/أيقونات/ألوان عشوائية أو تصميم مكرر بشكل آلي.

### Quality Gate
لا تعتبر الواجهة مكتملة من Screenshot واحد. يلزم اختبار تدفقات الأدوار الثلاثة ومقاسات الشاشة، مع إصلاح وإعادة اختبار كل مشكلة.
