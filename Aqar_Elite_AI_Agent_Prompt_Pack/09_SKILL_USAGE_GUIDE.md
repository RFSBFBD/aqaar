# Skills Usage Guide — الملفات المرفقة

هذه الحزمة لا تفترض أن كل Skill مثبتة في كل Agent. على الوكيل أولاً التحقق من وجود
المهارة وقراءة ملف SKILL.md الفعلي قبل استخدامها. لا تنسخ أوامر أداة غير متاحة.

## من web-skills.zip
- `anthropics-frontend-design`: استخدمها عند Phase 4 لتحديد هوية بصرية غير نمطية، مع مراجعة الخطة قبل البناء.
- `lackeyjb-playwright-skill`: أتمتة متصفح واختبار responsive/login/forms. اتبع تعليمات مسار المهارة وتشغيلها.
- `openai-playwright`: Playwright CLI للاستكشاف التفاعلي والتقاط snapshots/screenshots. لا تعتبره بديلاً تلقائياً عن Playwright Test specs.
- `anthropics-webapp-testing`: فحص تطبيق الويب المحلي ولقطات الشاشة وconsole logs.
- `openai-playwright-interactive`: تفاعل متصفح حي عند الحاجة.
- `anthropics-web-artifacts-builder`: ليس ضرورياً لبناء هذا التطبيق؛ لا تستخدمه لمجرد وجوده.
- `openai-vercel-deploy` و`openai-cloudflare-deploy`: خارج متطلبات التسليم الأساسية؛ Docker Compose هو معيار التشغيل المطلوب. لا تنشر المشروع إلا إذا طُلب ذلك.

## من awesome-agent-skills-main.zip
هذا الأرشيف يحتوي README/قائمة وروابط لمهارات، وليس كل المهارات نفسها. لا تدّعِ أن Skill متاحة محلياً قبل التحقق من تثبيتها. استخدم المهارات ذات الصلة فقط ولا تثبت مجموعة كبيرة بلا حاجة.

## قاعدة عدم التضارب
اختر أداة واحدة للاختبارات الرسمية:
- Playwright Test داخل المشروع مناسب لاختبار E2E المتكرر في CI.
- مهارات Playwright CLI/interactive للاستكشاف والتشخيص البصري.
- Webapp Testing قد يساعد في فحص المتصفح والـ console.
لا تجعل أكثر من أداة تكتب ملفات اختبار متكررة لنفس التدفق.
