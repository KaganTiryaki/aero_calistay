# Yönetici Girişi Brute Force Koruması Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ortak yönetici şifresiyle girişte IP başına 5 başarısız denemeden sonra 15 dakika engel uygulamak, başarısız denemelerde artan bekleme süresi eklemek ve şüpheli girişleri işlem geçmişinde görünür kılmak.

**Architecture:** Giriş endpoint'i, Supabase içindeki atomik bir rate-limit fonksiyonundan IP ve cihaz kimliği için karar alacak. Her başarısız giriş denemesi mevcut `admin_activity` kaydını `denied` sonucu ve yapılandırılmış ayrıntılarla tamamlayacak; limit, bekleme ve şüpheli durum bilgileri ayrı bir güvenlik tablosunda tutulacak. Başarılı girişte ilgili sayaç sıfırlanacak.

**Tech Stack:** Next.js App Router route handler, TypeScript, Supabase Postgres migration/RPC, Node test runner, mevcut `admin_activity` audit akışı.

**Spec:** Bu plan, kullanıcı isteğindeki üç korumayı uygular: IP başına 5 başarısız denemede 15 dakika engel, artan bekleme süresi, şüpheli IP işaretleme.

## Global Constraints

- Ortak yönetici şifresi ve mevcut Supabase Auth akışı korunacak.
- Personel giriş yapamayacak; `staff_members` içindeki aktif `admin` kontrolü değişmeyecek.
- Başarısız denemeler IP, cihaz, zaman ve sonuç bilgisiyle işlem geçmişine yazılacak.
- Başarılı girişte e-posta, şifre veya ham kimlik bilgisi audit ayrıntılarına yazılmayacak.
- `supabase/.temp/` dosyalarına dokunulmayacak.

## Review Focus

- Proxy başlıklarında sahte IP: yalnızca Vercel'in güvenilir istemci IP başlığı kabul edilmeli; rastgele `x-forwarded-for` değeri limiti aşındırmamalı.
- Eksik IP: IP yoksa cihaz kimliğiyle sınırlama uygulanmalı ve kayıt şüpheli işaretlenmeli.
- Dağıtık istek yarışı: eşzamanlı istekler 5 deneme sınırını atomik olarak aşmamalı.
- Engelli IP'nin doğru süresi: 15 dakika dolmadan giriş reddedilmeli, dolunca sayaç kontrollü biçimde yenilenmeli.
- Başarılı giriş sonrası reset: aynı IP'nin eski başarısızlıkları yeni oturuma taşınmamalı.

---

### Task 1: Rate-limit veri modeli ve atomik Supabase fonksiyonu

**Files:**
- Create: `supabase/migrations/202610010001_admin_login_rate_limit.sql`
- Modify: `tests/integration/database.test.mjs`

**Interfaces:**
- Produces `private.check_admin_login_rate_limit(p_ip inet, p_device_id uuid, p_now timestamptz)` returning `allowed boolean`, `wait_seconds integer`, `failure_count integer`, `suspicious boolean`.
- Produces `private.record_admin_login_failure(p_ip inet, p_device_id uuid, p_now timestamptz)` returning the same decision fields.
- Produces `private.reset_admin_login_failures(p_ip inet, p_device_id uuid)` for successful login.

- [ ] **Step 1: Write failing database tests** for first attempt allowed, fifth failed attempt allowed with increasing delay, sixth attempt blocked for 900 seconds, missing IP using device identity, and reset after success.
- [ ] **Step 2: Run the focused database test** with `npm.cmd test -- tests/integration/database.test.mjs`; confirm it fails because the table/functions do not exist.
- [ ] **Step 3: Add migration** with a server-only table keyed by normalized IP/device, `failure_count`, `last_failure_at`, `blocked_until`, and `suspicious`; use `pg_advisory_xact_lock` or an equivalent row lock so concurrent requests cannot bypass the threshold.
- [ ] **Step 4: Implement backoff values** of 1, 2, 4, 8, and 16 seconds for failures one through five, with a hard 900-second block after the fifth failure; mark `suspicious` at failure four and above.
- [ ] **Step 5: Re-run the focused tests** and confirm all concurrency, expiry, and reset assertions pass.

### Task 2: Login route integration and audit details

**Files:**
- Modify: `app/api/auth/shared-login/route.ts`
- Modify: `lib/activity/server.ts` only if a small typed helper is needed
- Create: `lib/auth/login-rate-limit.ts`
- Modify: `tests/unit/shared-admin-login.test.mjs`

**Interfaces:**
- `checkLoginRateLimit(request: NextRequest, deviceId: string): Promise<{ allowed: boolean; waitSeconds: number; failureCount: number; suspicious: boolean }>`.
- `recordLoginFailure(request: NextRequest, deviceId: string): Promise<...>`.
- `resetLoginFailures(request: NextRequest, deviceId: string): Promise<void>`.

- [ ] **Step 1: Add unit tests** for blocked responses (`429` with `Retry-After`), increasing `Retry-After`, suspicious audit details, and successful reset.
- [ ] **Step 2: Run `npm.cmd test -- tests/unit/shared-admin-login.test.mjs`** and verify the new tests fail.
- [ ] **Step 3: Call the rate-limit check after `protectMutation` and before Supabase password verification**; return Turkish `429` response with `Retry-After` when blocked, without attempting Auth login.
- [ ] **Step 4: On every wrong password or rejected admin membership**, record a failure and finish the existing activity row as `denied` with details `{ reason: "invalid_credentials" | "not_admin", failureCount, suspicious, waitSeconds }`.
- [ ] **Step 5: On successful login**, call the reset function only after membership and claims validation succeed; retain the existing activity success record.
- [ ] **Step 6: Run focused unit tests, then full `npm.cmd test` and `npm.cmd run lint`**; verify no password or token is present in logs or audit details.

### Task 3: Activity page visibility for suspicious IPs

**Files:**
- Modify: `app/(operations)/panel/etkinlik/page.tsx` or its client component discovered by the existing route
- Modify: `app/(operations)/operations.css`
- Modify: `tests/unit/activity-metadata.test.mjs` or add `tests/unit/admin-login-rate-limit.test.mjs`

**Interfaces:**
- The existing activity API continues returning `admin_activity.details` and `ip_address`.
- The UI renders a clear `Şüpheli` badge when `details.suspicious === true` or `details.failureCount >= 4`.

- [ ] **Step 1: Add a rendering/data-shape test** covering a denied login with `failureCount: 4`, `suspicious: true`, IP, device class, and timestamp.
- [ ] **Step 2: Update the activity row** to show `Şüpheli giriş`, failure count, temporary wait/block duration, IP, device class, and time in plain Turkish; never show the password.
- [ ] **Step 3: Add a high-contrast badge style** that remains readable on mobile and does not rely on color alone.
- [ ] **Step 4: Run the activity test and `npm.cmd run build`**.

### Task 4: End-to-end verification and deployment gate

**Files:**
- Modify only tests or documentation if verification exposes a real defect.

- [ ] **Step 1: Run `npm.cmd test`, `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build`.
- [ ] **Step 2: In a local or isolated test environment, submit six wrong passwords from one IP/device and verify attempts 1–5 receive increasing delays, attempt 6 receives `429`, and `Retry-After` is about 900 seconds.
- [ ] **Step 3: Verify the activity page shows each denied attempt and marks the fourth/fifth attempts as suspicious with IP/device data.
- [ ] **Step 4: Verify a correct password is rejected during the block, then succeeds after expiry or an explicit test reset; confirm the next failed sequence starts at one.
- [ ] **Step 5: Review `git diff --check`, confirm `supabase/.temp/` is untouched, and deploy only after the migration has been applied to the intended Supabase project.

## Self-review checklist

- All three requested protections map to Tasks 1–3.
- Proxy/IP spoofing, missing IP, concurrency, expiry, and reset are explicitly tested.
- No production migration or deployment is included in the plan without a separate verification gate.
- The shared password remains supported, but its brute-force exposure is materially reduced.
