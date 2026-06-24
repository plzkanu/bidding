# 실행 방법

SOOSAN 입찰 · 견적 시스템을 로컬 또는 운영 환경에서 실행하는 방법입니다.

## 사전 요구 사항

| 항목 | 권장 버전 |
|------|-----------|
| Node.js | 20.x 이상 |
| npm | 10.x 이상 (Node.js에 포함) |

Supabase를 연결해 입찰공고·관심공고·메모 기능을 사용하려면 [Supabase](https://supabase.com) 프로젝트가 필요합니다.

---

## 1. 의존성 설치

프로젝트 루트에서 다음을 실행합니다.

```bash
npm install
```

---

## 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 아래 변수를 설정합니다.

```env
# 세션 서명용 (운영 환경에서는 반드시 긴 랜덤 문자열로 변경)
AUTH_SECRET=your-secret-key-here

# Supabase (입찰공고 조회·관심공고·메모에 필요)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

| 변수 | 필수 | 설명 |
|------|------|------|
| `AUTH_SECRET` | 권장 | 로그인 세션 쿠키 서명. 미설정 시 개발용 기본값 사용 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 사용 시 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 사용 시 | 서버 API용 Service Role Key |
| `SUPABASE_SSL_VERIFY` | 선택 | 회사 VPN/방화벽에서 Supabase HTTPS 실패 시 `0` (TLS 검증 생략) |

> Supabase 변수가 없으면 로그인·사용자 관리는 동작하지만, 입찰공고 조회·관심공고·메모·대시보드 통계는 사용할 수 없습니다.

회사 네트워크에서 `GET /api/crawl-sites` 등 Supabase API가 500(약 7초 후 `fetch failed`)으로 실패하면 `.env.local`에 `SUPABASE_SSL_VERIFY=0`을 추가하고 개발 서버를 재시작하세요. (LG엑사원 API의 `FRIENDLI_SSL_VERIFY=0`과 같은 목적입니다.)

환경 변수를 변경한 뒤에는 **개발 서버를 재시작**해야 반영됩니다.

---

## 3. Supabase 마이그레이션 (선택)

입찰공고 관련 기능을 사용하려면 Supabase SQL Editor에서 아래 파일을 **순서대로** 실행합니다.

1. `supabase/migrations/001_khnp_bid_notice.sql` — 입찰공고 테이블 (이미 적용된 경우 생략 가능)
2. `supabase/migrations/002_user_bid_favorites.sql` — 관심공고
3. `supabase/migrations/003_user_bid_notice_memos.sql` — 공고별 메모
4. `supabase/migrations/010_manual_bid_notice.sql` — **공고 직접 등록** (`source`, `created_by` 컬럼)

> 공고 직접 등록 시 `created_by` 컬럼 오류가 나면 010 마이그레이션을 적용한 뒤 Supabase **Project Settings → API → Reload schema cache** 를 실행하세요.

또한 `crawl_sites` 테이블에 입찰공고 수집 사이트(예: 한수원 KPOS)가 등록되어 있어야 합니다. 관리자 메뉴 **입찰공고 조회 사이트 관리**에서 추가할 수 있습니다.

---

## 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속합니다.  
루트(`/`)는 로그인 페이지(`/login`)로 이동합니다.

### 기본 관리자 계정

Supabase `bid_users` 테이블에 사용자가 없으면 최초 로그인 시 아래 계정이 자동 생성됩니다.

| 아이디 | 비밀번호 | 역할 |
|--------|----------|------|
| `admin` | `admin123` | 관리자 |

로그인 후 기본 화면은 **대시보드**(`/dashboard`)입니다.

> 운영 환경에서는 `AUTH_SECRET`을 변경하고, 관리자 비밀번호를 반드시 바꾸세요.

---

## 5. 운영(프로덕션) 빌드 및 실행

```bash
npm run build
npm run start
```

기본 포트는 **3000**입니다. 다른 포트를 쓰려면:

```bash
# Windows (PowerShell)
$env:PORT=8080; npm run start

# macOS / Linux
PORT=8080 npm run start
```

---

## 6. 기타 npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (핫 리로드) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint 검사 |

---

## 7. 주요 접속 경로

| URL | 설명 |
|-----|------|
| `/login` | 로그인 |
| `/dashboard` | 대시보드 (관심공고·마감 임박 현황) |
| `/dashboard/announcements` | 입찰공고 조회 |
| `/dashboard/favorites` | 관심공고 |
| `/dashboard/admin` | 관리자 메뉴 (관리자 전용) |

---

## 문제 해결

### `npm install` 실패

- Node.js 20 이상인지 확인: `node -v`
- 네트워크·프록시 환경이면 npm 레지스트리 접근 가능 여부 확인

### 로그인은 되지만 입찰공고가 보이지 않음

- `.env.local`에 Supabase URL·Service Role Key가 올바른지 확인
- Supabase에 `crawl_sites`, `khnp_bid_notice` 등 테이블·데이터 존재 여부 확인
- 개발 서버 재시작

### 관심공고·메모 저장 오류

- `002_user_bid_favorites.sql`, `003_user_bid_notice_memos.sql` 마이그레이션 적용 여부 확인

### 포트 3000이 이미 사용 중

다른 포트로 개발 서버 실행:

```bash
# Windows (PowerShell)
$env:PORT=3001; npm run dev

# macOS / Linux
PORT=3001 npm run dev
```

---

## 데이터 저장 위치

| 데이터 | 저장 위치 |
|--------|-----------|
| 사용자 계정 | Supabase `bid_users` |
| 입찰공고·사이트·관심·메모 | Supabase PostgreSQL |
