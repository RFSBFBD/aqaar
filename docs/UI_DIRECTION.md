# UI & Visual Direction — Aqar Elite (Phase 4)

## 1. Users & Primary Tasks
| Role | Primary Tasks |
|------|---------------|
| **مدير الشركة (`ADMIN`)** | إضافة وتعديل الوحدات، تعديل الأسعار (للوحدات المتاحة فقط)، متابعة الحجوزات والعقود، مراجعة سجل التدقيق. |
| **مندوب المبيعات (`SALES`)** | تصفية واستعراض الوحدات، إضافة وتحديث بيانات عملائه، حجز وحدة متاحة لمدة 72 ساعة، إنشاء مسودة عقد من حجز نشط. |
| **المحاسب (`ACCOUNTANT`)** | مراجعة مسودات العقود واعتمادها، متابعة جداول الأقساط وحالات التأخير، تسجيل الدفعات ومراجعة توزيعها على الأقساط الأقدم. |

## 2. Visual Identity — Architectural Limestone & Ledger
- **Direction:** Crisp, flat administrative ledger inspired by architectural property registries. No generic SaaS purple gradients, no glassmorphism, no decorative hero images, no card-wrapped everything.
- **Color Tokens (5 core HEX):**
  - `--bg-canvas: #F7F5F0` (Warm Limestone Paper)
  - `--bg-surface: #FFFFFF` (Ledger White)
  - `--border-hairline: #E2DDD3` (Warm Stone Border)
  - `--ink-primary: #1B2420` / `--ink-secondary: #56615B`
  - `--accent-primary: #14533C` (Cypress Emerald, hover `#0F402E`)
  - Semantic statuses: Available/Paid/Approved `#15803D` (`#ECFDF5` bg), Reserved/Draft/Partial `#A16207` (`#FEFCE8` bg), Overdue/Error `#B91C1C` (`#FEF2F2` bg).
- **Typography:** RTL Arabic with `tabular-nums` for all monetary amounts, dates, and IDs; `line-height: 1.6` for comfortable Arabic legibility.
- **Spacing & Radii:** 4px scale (`8, 12, 16, 24, 32px`), subtle `6px`–`8px` corners, hairline `1px` borders instead of drop-shadow noise.
- **Icons:** `lucide-react` SVG icons paired with explicit Arabic text on all critical actions.

## 3. Navigation & Screen Architecture
- **RTL Right Sidebar + Top Context Bar** (responsive drawer on `< 768px` mobile).
- **Screens (strictly in-scope):**
  1. `/login` — Focused sign-in screen (cookie session auth).
  2. `/units` — Units table/mobile list with server-side filters (status, min/max price), allowlist sorting (price/area), pagination, role-gated actions (ADMIN add/edit, SALES reserve).
  3. `/clients` & `/clients/[id]` — Client directory & detail view with plain-text notes, SALES create/edit.
  4. `/reservations` — Reservation register with 72h expiry status & SALES draft-contract creation.
  5. `/contracts` & `/contracts/[id]` — Contracts register + full ledger detail: financial summary, ACCOUNTANT approve confirmation, installment schedule table, ACCOUNTANT payment form with client-generated idempotency key & FIFO allocation feedback.
  6. `/audit-logs` — ADMIN read-only audit trail.
