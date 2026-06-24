# Supabase 설정 가이드

SOOSAN 입찰 · 견적 시스템에서 Supabase(PostgreSQL + Storage)를 연결·운영하는 방법입니다.

---

## 개요

| 항목 | 내용 |
|------|------|
| 클라이언트 라이브러리 | `@supabase/supabase-js` (^2.107) |
| 연결 방식 | **서버 전용** — Next.js API Route / Server Component에서만 사용 |
| 인증 키 | `SUPABASE_SERVICE_ROLE_KEY` (Service Role) |
| 앱 사용자 인증 | Supabase Auth **미사용** — `bid_users` 테이블 + bcrypt 세션 쿠키 |

Supabase가 설정되지 않으면 로그인·사용자 관리·입찰공고 조회 등 **모든 기능**을 사용할 수 없습니다.

---

## 1. Supabase 프로젝트 준비

1. [Supabase](https://supabase.com)에서 프로젝트를 생성합니다.
2. 대시보드 → **Project Settings → API**에서 아래 값을 확인합니다.
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. (선택) **anon public** 키는 UI 안내용으로만 표시되며, 현재 앱 코드에서는 **사용하지 않습니다**.

---

## 2. 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 다음 변수를 설정합니다.

```env
# Supabase (입찰공고·업무 데이터)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 회사 VPN/방화벽에서 Supabase HTTPS 연결 실패 시 (선택)
SUPABASE_SSL_VERIFY=0
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 사용 시 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 사용 시 | 서버 API용 Service Role Key. **클라이언트에 노출 금지** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 아니오 | UI 안내용. 코드에서 미사용 |
| `SUPABASE_SSL_VERIFY` | 아니오 | `0`, `false`, `no`, `off` 중 하나면 TLS 인증서 검증 생략 |

환경 변수를 변경한 뒤에는 **개발 서버를 재시작**해야 반영됩니다.

### 설정 확인 로직

- `src/lib/supabase/config.ts` — `isSupabaseConfigured()`, `getSupabaseConfigError()`, `isSupabaseTlsInsecure()`
- `src/lib/supabase/server.ts` — `createServerClient()` (Service Role + 세션 비활성)
- Supabase 미설정 시 대시보드 등 화면에 `SupabaseConfigAlert` 컴포넌트가 표시됩니다.

---

## 3. 회사망 / VPN TLS 문제

회사 VPN·방화벽 환경에서 Supabase API 호출이 약 7초 후 `fetch failed` 또는 인증서(OCSP) 관련 오류로 실패할 수 있습니다.

**해결:** `.env.local`에 아래를 추가하고 서버를 재시작합니다.

```env
SUPABASE_SSL_VERIFY=0
```

내부적으로 `NODE_TLS_REJECT_UNAUTHORIZED=0`이 적용됩니다. 개발 환경에서만 사용하고, 운영 환경에서는 네트워크 정책 확인 후 필요할 때만 설정하세요.

관련 코드: `src/lib/supabase/fetch.ts` — `applySupabaseTlsBypassIfConfigured()`, `formatSupabaseNetworkError()`

---

## 4. 마이그레이션 적용

SQL 파일은 `supabase/migrations/` 에 있습니다. Supabase 대시보드 **SQL Editor**에서 **번호 순서대로** 실행하세요.

| 순서 | 파일 | 내용 |
|------|------|------|
| — | *(사전)* | `crawl_sites` 테이블 — 마이그레이션에 없음. 크롤링/사이트 관리용으로 **별도 존재**해야 함 |
| 001 | `001_khnp_bid_notice.sql` | KPOS 입찰공고 마스터·상세 테이블 (`khnp_bid_notice`, `khnp_bid_open`, `khnp_bid_private`, `khnp_bid_plan_spec`) |
| 002 | `002_user_bid_favorites.sql` | 관심공고 (`user_bid_favorites`) |
| 003 | `003_user_bid_notice_memos.sql` | 공고별 메모 (`user_bid_notice_memos`) |
| 004 | `004_user_bid_submissions.sql` | 입찰 등록 (`user_bid_submissions`) |
| 005 | `005_user_estimate_submissions.sql` | 견적 등록 (`user_estimate_submissions`) |
| 006 | `006_user_order_reports.sql` | 발주보고 등록 (`user_order_reports`) |
| 007 | `007_bid_notice_attachments.sql` | 첨부 메타 + Storage 버킷 `bid-notice-attachments` |
| 008 | `008_user_bid_notice_screening.sql` | 공고 선별 상태 (`user_bid_notice_screening`) |
| 009 | `009_user_order_report_summaries.sql` | 발주요약 메타 + Storage 버킷 `order-report-summaries` |
| 010 | `010_manual_bid_notice.sql` | 수동 공고 등록용 컬럼 (`source`, `created_by`) |
| 011 | `011_order_report_pq_status.sql` | 발주요약 PQ 필드 (`pq_has_pq`, `pq_submission_date`) |
| 012 | `012_bid_notice_screening_keywords.sql` | 자동선별 키워드 (`bid_notice_screening_keywords`) |
| 013 | `013_departments_and_bid_notice_assignments.sql` | 담당부서·공고 배정 (`departments`, `bid_notice_assignments`) |
| 014 | `014_bid_users.sql` | 앱 사용자 계정 (`bid_users`) |

> **001** 은 Supabase에 이미 KPOS 테이블이 있으면 생략 가능합니다.  
> **010** 적용 후 `created_by` 컬럼 오류가 나면 **Project Settings → API → Reload schema cache** 를 실행하세요.

Supabase CLI를 쓰는 경우, 동일 SQL을 `supabase db push` 또는 migration track에 맞게 적용하면 됩니다. 이 저장소에는 CLI 설정 파일(`config.toml`)은 포함되어 있지 않습니다.

---

## 5. 테이블 구조 요약

### 입찰공고 (KPOS)

| 테이블 | 용도 |
|--------|------|
| `crawl_sites` | 입찰공고 수집 사이트 (한수원 KPOS 등). 관리자 메뉴에서 CRUD |
| `khnp_bid_notice` | 공고 마스터 (`site_id`, `notice_type`, `notice_no`, `title`, …) |
| `khnp_bid_open` | 공개입찰 상세 |
| `khnp_bid_private` | 수의계약 상세 |
| `khnp_bid_plan_spec` | 계획·규격 공고 상세 |

`khnp_bid_notice` 추가 컬럼 (010):

- `source`: `'crawl'` \| `'manual'`
- `created_by`: 수동 등록 시 등록자 `user_id`

### 사용자별 업무 데이터

모든 `user_id`는 **`bid_users` 테이블의 사용자 `id` 문자열**입니다.

| 테이블 | 용도 |
|--------|------|
| `user_bid_favorites` | 관심공고 |
| `user_bid_notice_memos` | 공고 메모 |
| `user_bid_submissions` | 입찰하기 |
| `user_estimate_submissions` | 견적내기 |
| `user_order_reports` | 발주보고 |
| `user_bid_notice_screening` | 선별 상태 (`WAITING`, `EXCLUDED`, `TARGET`) |
| `user_order_report_summaries` | AI 발주요약 결과 (JSON + DOCX 경로) |

### 조직·관리

| 테이블 | 용도 |
|--------|------|
| `bid_users` | 앱 로그인 사용자 (관리자·일반) |
| `departments` | 담당부서 |
| `bid_notice_assignments` | 공고별 부서·담당자 배정 (공고당 1건) |
| `bid_notice_screening_keywords` | 자동선별 키워드 |

### 첨부파일

| 테이블 | 용도 |
|--------|------|
| `bid_notice_attachments` | 공고 첨부 메타 (`storage_path`, `file_name`, …) |

---

## 6. Storage 버킷

마이그레이션 007·009에서 **비공개(private)** 버킷을 생성합니다. 업·다운로드는 서버의 Service Role로만 처리합니다.

| 버킷 ID | 용도 | 파일 크기 한도 | 마이그레이션 |
|---------|------|----------------|--------------|
| `bid-notice-attachments` | 입찰공고 첨부 | 50 MB | 007 |
| `order-report-summaries` | 발주요약 DOCX | 20 MB | 009 |

앱 상수:

- `src/lib/bid-notices/attachments.ts` — `ATTACHMENTS_BUCKET`, `ATTACHMENT_MAX_BYTES`
- `src/lib/order-report-summary/summaries.ts` — `SUMMARIES_BUCKET`

첨부·발주요약 API는 버킷/테이블이 없을 때 해당 SQL 파일 적용을 안내하는 메시지를 반환합니다.

---

## 7. 기능별 필요 마이그레이션

| 기능 | 최소 필요 마이그레이션 |
|------|------------------------|
| 입찰공고 조회 | `crawl_sites`, 001 |
| 관심공고 | 002 |
| 공고 메모 | 003 |
| 입찰하기 / 견적내기 / 발주보고 | 004 / 005 / 006 |
| 공고 첨부 | 007 |
| 공고 선별 | 008 |
| AI 발주요약 | 009, 011 |
| 공고 직접 등록 | 010 |
| 자동선별 키워드 | 012 |
| 담당부서·배정 공고 | 013 |
| 사용자 계정 (로그인) | 014 |

---

## 8. 초기 데이터

1. **`crawl_sites`** — 한수원 KPOS 등 수집 사이트가 등록되어 있어야 `/dashboard/announcements`에서 공고를 조회할 수 있습니다.  
   관리자 → **입찰공고 조회 사이트 관리** (`/dashboard/admin/crawl-sites`)에서 추가합니다.
2. **`khnp_bid_notice`** — 크롤러 또는 **공고 직접 등록**(010 적용 후)으로 데이터가 쌓입니다.

---

## 9. 보안 참고

- **Service Role Key**는 RLS를 우회합니다. 반드시 서버 환경 변수에만 두고 Git에 커밋하지 마세요.
- `.env.local`은 `.gitignore`에 포함되어 있어야 합니다.
- 앱 로그인은 자체 세션(`AUTH_SECRET`) + Supabase `bid_users`이며, Supabase Auth와 연동하지 않습니다.

---

## 10. 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| 입찰공고가 비어 있음 | Supabase URL·키, `crawl_sites`·`khnp_bid_notice` 데이터, 서버 재시작 |
| API 500 + `fetch failed` (약 7초) | `SUPABASE_SSL_VERIFY=0` 설정 후 재시작 |
| `Could not find the table` / schema cache | 해당 마이그레이션 SQL 실행 → **Reload schema cache** |
| 관심공고·메모 저장 실패 | 002, 003 적용 여부 |
| 첨부 업로드 실패 | 007 적용 (테이블 + `bid-notice-attachments` 버킷) |
| 발주요약 실패 | 009, 011 적용 (테이블 + `order-report-summaries` 버킷) |
| 수동 공고 `created_by` 오류 | 010 적용 + schema cache reload |

---

## 11. 관련 소스 파일

```
src/lib/supabase/
  config.ts    # 환경 변수·TLS 설정
  server.ts    # createServerClient()
  fetch.ts     # 네트워크 오류 메시지·TLS 우회

src/lib/crawl-sites.ts
src/lib/departments.ts
src/lib/bid-notices/          # 입찰공고·업무 DB 접근
src/lib/order-report-summary/summaries.ts

src/components/supabase-config-alert.tsx

supabase/migrations/          # SQL 마이그레이션 001–013
```

실행 절차 전체는 [RUN.md](../RUN.md), 기능 개요는 [README.md](../README.md)를 참고하세요.
