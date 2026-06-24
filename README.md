# 입찰 · 견적 시스템

SOOSAN 입찰 및 견적 관리 시스템입니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 시 로그인 페이지로 이동합니다.

## 기본 관리자 계정

Supabase `bid_users` 테이블에 사용자가 없으면 최초 접속 시 아래 계정이 자동 생성됩니다.  
(`supabase/migrations/014_bid_users.sql` 또는 `apply-all-migrations.sql` 적용 시 시드 데이터 포함)

| 아이디 | 비밀번호 | 역할 |
|--------|----------|------|
| `admin` | `admin123` | 관리자 |

운영 환경에서는 `.env.local`에 `AUTH_SECRET`을 설정하고, 관리자 비밀번호를 반드시 변경하세요.

## Supabase 연결

`.env.example`을 참고해 `.env.local`에 Supabase URL과 키를 설정한 뒤 서버를 재시작하세요.

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (선택) 클라이언트용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버에서 `crawl_sites` 조회·관리 |

입찰공고 사이트 데이터는 Supabase `public.crawl_sites` 테이블을 사용합니다.

KPOS(한수원) 입찰공고는 `khnp_bid_notice` 및 유형별 상세 테이블(`khnp_bid_open`, `khnp_bid_private`, `khnp_bid_plan_spec`)에 저장되며, `/dashboard/announcements`에서 사이트·공고 유형별로 조회합니다.

관심공고는 Supabase `user_bid_favorites` 테이블에 로그인 사용자 ID(`bid_users.id`)별로 저장됩니다. `supabase/migrations/002_user_bid_favorites.sql`을 Supabase에 적용해야 합니다.

공고별 개인 메모는 `user_bid_notice_memos` 테이블에 사용자·공고 단위로 저장됩니다. `supabase/migrations/003_user_bid_notice_memos.sql`을 적용하세요.

## 페이지

| 경로 | 설명 |
|------|------|
| `/login` | 로그인 화면 (SOOSAN BI 로고 표시) |
| `/dashboard/announcements` | 입찰공고 조회 |
| `/dashboard/favorites` | 관심공고 (사용자별) |
| `/dashboard/bid` | 입찰하기 |
| `/dashboard/estimate` | 견적내기 |
| `/dashboard/admin` | 관리자메뉴 (관리자 전용) |
| `/dashboard/admin/users` | 사용자관리 (관리자 전용) |
| `/dashboard/admin/crawl-sites` | 입찰공고 조회 사이트 관리 (관리자 전용) |

## 기술 스택

- Next.js (App Router)
- TypeScript
- Tailwind CSS
