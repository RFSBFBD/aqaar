# FINAL ACCEPTANCE AUDIT — Independent Reviewer

أنت مراجع تقني مستقل لم تشارك في تنفيذ المشروع. لا تفترض أن المطور صادق أو أن الاختبارات كافية.
هدفك تقرير هل يطابق المشروع مستند `RA-HR-2026-1110` فعلياً.

## 1) مراجعة المتطلبات
طابق كل بند في PDF مع:
- implementation file.
- API/service.
- database constraint/migration.
- test evidence.
- README explanation.

## 2) اختبار المسار الكامل
- Login agent.
- Create/choose client.
- Reserve available unit for 72h.
- Draft contract from active reservation.
- Login accountant.
- Approve contract.
- Verify unit sold.
- Verify installment schedule exact sum.
- Record payment.
- Verify allocation to oldest unpaid installments.
- Verify remaining balance.

## 3) اختبارات الهجوم
- Cross-tenant access.
- Cross-agent client access.
- Role escalation.
- Mass assignment.
- forged companyId.
- forged ownerId.
- invalid filters/sort/page.
- expired session and logout replay.
- brute-force protection.
- XSS in notes.
- duplicate payment replay.
- concurrent reservation.
- concurrent payments.
- transaction rollback.
- direct update/delete of payment.
- modification of approved contract.

## 4) مراجعة مالية
تحقق حسابياً من:
- لا float.
- الدفعة الأولى + الأقساط = final price.
- rounding deterministic.
- no overpayment.
- payment allocations sum = payment amount.
- remaining balance never negative.
- due dates match documented policy.

## 5) مراجعة الجودة
- TypeScript strict.
- no any.
- no unused dependencies/imports.
- no dead code introduced.
- no unjustified abstraction.
- readable separation of concerns.
- no business logic in UI.
- no secrets in repository/client bundle/logs.
- no console errors.
- responsive Arabic RTL.
- meaningful icons and coherent design tokens.
- no generic library-default purple theme.
- no fake controls or placeholder actions.

## 6) أوامر التحقق
شغّل الأوامر الفعلية الموجودة في package scripts، مثل:
- lint
- typecheck
- test
- test:integration
- test:e2e
- build
- npm audit
لا تفترض وجود script قبل فحص package.json.

## 7) تقرير القرار
أنشئ `docs/FINAL_ACCEPTANCE_REPORT.md` ويحتوي:
- PASS / FAIL / BLOCKED.
- Requirements coverage.
- Tests executed with exact commands/results.
- Security findings by severity.
- Financial correctness findings.
- Docker clean-run result.
- Known limitations.
- هل المشروع جاهز للتسليم أم لا؟
- قائمة الإصلاحات المطلوبة مرتبة بالأولوية.

لا تمنح PASS إذا كان هناك أي blocker، أو لم يتم اختبار concurrency على PostgreSQL، أو لم يثبت عزل الشركات، أو لم يعمل Docker من clean clone.
