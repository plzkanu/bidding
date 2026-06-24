# 발주요약 기능 — Gemini API · DOCX 생성 · 환경변수

입찰 공고 첨부파일(PDF, DOCX, TXT, HWP/HWPX)을 분석해 **발주요약**을 생성하고 DOCX로 저장하는 기능의 코드 구조와 설정 방법입니다.

---

## 전체 처리 흐름

```
[클라이언트] POST /api/order-report-summaries/{noticeId}
       │
       ▼
[summaries.ts] generateOrderReportSummary()
  ├─ 첨부파일 다운로드 (Supabase Storage)
  ├─ [Gemini] summarizeOrderReportWithGemini()  ← LLM 요약
  ├─ [DOCX] buildOrderReportSummaryDocx()       ← Word 문서 생성
  ├─ Supabase Storage 업로드 (order-report-summaries 버킷)
  └─ DB 저장 (user_order_report_summaries)
       │
       ▼
[클라이언트] GET /api/order-report-summaries/{noticeId}/download  ← DOCX 다운로드
```

---

## 1. Gemini API 호출 (요약 생성)

### 1.1 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/gemini/config.ts` | API 키·모델·TLS 설정 (환경변수 읽기) |
| `src/lib/gemini/http-client.ts` | Google Generative Language API HTTP 클라이언트 |
| `src/lib/gemini/generate-content.ts` | `generateContent` 호출 및 JSON 응답 추출 |
| `src/lib/gemini/summarize-order-report.ts` | **메인 요약 로직** — 첨부파일 전처리 + Gemini 호출 |
| `src/lib/gemini/order-report-schema.ts` | Gemini `responseSchema` (구조화 JSON 스키마) |
| `src/lib/order-report-summary/prompt.ts` | 시스템 프롬프트 (추출 규칙·PDF 시각 분석 지시) |
| `src/lib/order-report-summary/text-hints.ts` | 기초금액·추정가격 힌트 추출 및 후처리 |
| `src/lib/order-report-summary/gemini-text-preprocess.ts` | HWP 등에서 추출한 텍스트 정규화 |
| `src/lib/order-report-summary/hwp-to-pdf.ts` | HWP/HWPX → PDF 변환 (Gemini inline 업로드용) |
| `src/lib/order-report-summary/hwp-text.ts` | 첨부파일에서 순수 텍스트 추출 |
| `src/lib/order-report-summary/config.ts` | LLM 타임아웃·기본 모델 등 발주요약 전용 상수 |

### 1.2 API 엔드포인트

- **생성**: `POST /api/order-report-summaries/{noticeId}`  
  → `src/app/api/order-report-summaries/[noticeId]/route.ts`  
  → `generateOrderReportSummary()` 호출 (최대 120초, `maxDuration = 120`)
- **조회**: `GET /api/order-report-summaries/{noticeId}`

### 1.3 핵심 함수: `summarizeOrderReportWithGemini()`

**위치**: `src/lib/gemini/summarize-order-report.ts`

처리 순서:

1. **환경변수 확인** — `GEMINI_API_KEY` 없으면 오류
2. **첨부파일 → Gemini parts 변환** (`buildAttachmentParts`)
   - 지원 형식: PDF, DOCX, TXT, HWP/HWPX(→PDF 변환)
   - ZIP 파일은 건너뜀
   - 단일 파일 최대 **20MB** (`GEMINI_INLINE_MAX_BYTES`)
   - HWP는 `convertHwpBufferToPdf()`로 PDF 변환 후 `inlineData`로 base64 전송
   - PDF/DOCX/TXT는 원본을 `inlineData`로 전송 + 텍스트 힌트용 plain text 추출
3. **금융 힌트 생성** — plain text에서 기초금액·추정가격 후보 추출 (`text-hints.ts`)
4. **프롬프트 조립**
   - `ORDER_REPORT_SUMMARY_PROMPT` (추출 규칙)
   - 공고 메타데이터 (`buildNoticeContext`)
   - 금융 힌트 블록
5. **Gemini API 호출** — `generateGeminiJsonContent()`
6. **응답 파싱·후처리**
   - JSON 파싱 → `parseOrderReportSummaryData()`
   - 금융 힌트 적용 (`applyFinancialHints`)
   - 공고 메타데이터 보강 (`enrichSummaryWithNoticeMetadata`)

### 1.4 HTTP 클라이언트

**위치**: `src/lib/gemini/http-client.ts`

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
```

- Node.js `https` 모듈 사용 (fetch 아님)
- `GEMINI_TLS_INSECURE=true` 시 SSL 인증서 검증 우회 (사내 프록시용)

### 1.5 `generateGeminiJsonContent()`

**위치**: `src/lib/gemini/generate-content.ts`

요청 본문 구조:

```json
{
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "<시스템 프롬프트 + 공고 컨텍스트 + 힌트>" },
      { "inlineData": { "mimeType": "application/pdf", "data": "<base64>" } },
      { "text": "[첨부파일: ...]" }
    ]
  }],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": { ... }
  }
}
```

응답에서 `candidates[0].content.parts[].text`를 합쳐 JSON 문자열로 반환합니다.

### 1.6 응답 JSON 스키마

**위치**: `src/lib/gemini/order-report-schema.ts`

Gemini가 반환해야 하는 구조 (한글 키):

| 키 | 타입 | 설명 |
|----|------|------|
| `발주기관` | string | 발주 기관명 |
| `공고명` | string | 공고 제목 |
| `공고번호` | string | 공고 번호 |
| `생성일시` | string | 문서 기준 일시 |
| `공사개요` | array | `{ 공사명, 기초금액, 공사기간, 비고 }[]` |
| `주요일정` | array | `{ 날짜, 단계 }[]` |
| `신청자격` | array | `{ 구분, 기준 }[]` |
| `담당자` | object | `{ 부서, 이름, 연락처 }` |

### 1.7 프롬프트 (`prompt.ts`)

**위치**: `src/lib/order-report-summary/prompt.ts`

| export | 용도 |
|--------|------|
| `ORDER_REPORT_PDF_VISUAL_PROMPT` | HWP→PDF 변환 첨부의 표·글상자 시각 분석 지시 |
| `ORDER_REPORT_SUMMARY_PROMPT` | 메인 시스템 프롬프트 (위 상수를 `${...}`로 포함) |

Gemini 호출 시 `summarize-order-report.ts`에서 아래 순서로 프롬프트를 조립합니다.

```
ORDER_REPORT_SUMMARY_PROMPT
+ buildNoticeContext(공고 메타데이터)
+ buildFinancialHintPromptBlock(기초금액·추정가격 힌트)
```

#### `ORDER_REPORT_PDF_VISUAL_PROMPT`

```
## PDF 시각 분석 (최우선)

첨부된 PDF는 HWP 원본을 변환한 입찰 안내서입니다. **텍스트가 아닌 문서의 시각적 레이아웃(표, 글상자, 점선 테두리 목록)**을 분석하세요.

**반드시 수행할 작업:**
첨부된 PDF 문서의 **표(Table)** 에 기재된 다음 항목을 찾아 정확히 추출하세요.
- **추정가격**
- **예비가격기초금액**

「입찰에 부치는 사항」 등 2열 표에서 왼쪽 셀=항목명, 오른쪽 셀=금액(￦, ₩, 쉼표, 끝 하이픈 포함)인 경우가 많습니다.
표 셀 경계·병합·글상자 안 목록을 보고 항목명과 금액을 짝지어 읽으세요.

금액이 ￦414,328,730- (부가가치세 포함) 형태이면:
- JSON 공사개요.기초금액: "414,328,730원 (부가가치세 포함)" (천 단위 콤마 + 원 단위)
- 추정가격은 공사개요.비고에 "추정가격: 376,662,482원 (부가가치세 별도)" 형태로 기록

숫자 뒤 하이픈(-)은 마이너스가 아닙니다. 금액을 누락하지 마세요.
```

#### `ORDER_REPORT_SUMMARY_PROMPT`

> 아래 본문 중 `## PDF 시각 분석 (최우선)` 섹션은 코드에서 `ORDER_REPORT_PDF_VISUAL_PROMPT`가 삽입됩니다.

```
당신은 입찰 문서에서 핵심 금융 데이터를 오차 없이 추출하는 **정밀 데이터 추출기**입니다.
첨부 PDF·DOCX 등을 **시각적으로** 분석해 입찰 판단에 필요한 금융·일정·자격 정보를 누락 없이 추출합니다.

## PDF 시각 분석 (최우선)
(... ORDER_REPORT_PDF_VISUAL_PROMPT 내용 ...)

## 추정가격·예비가격기초금액 — 3단계 추출 규칙 (필수)

각 항목마다 아래 3단계를 **내부적으로 순서대로 적용(Thought)**한 뒤, 최종 결과만 JSON에 기록하세요.
(추론 과정은 출력하지 않고, response_schema JSON만 출력합니다.)

### [추출 규칙]
1. **원문 라인 복사(Verbatim)**: PDF 표에서 해당 단어가 포함된 **행/셀**을 원문 그대로 내부적으로 기록하세요.
2. **금액 숫자 추출**: 원화 기호·끝 하이픈(-) 제거 후 숫자만 사용
3. **표시 형식**: 천 단위 콤마(,) + **원** 단위 + 괄호 설명
   - "₩376,662,482-" → "376,662,482원 (부가가치세 별도)"
   - "￦414,328,730-" → "414,328,730원 (부가가치세 포함)"

### [금액 필드 매핑]
- 예비가격기초금액 → 공사개요[].기초금액
- 추정가격 → 공사개요[].비고 첫 줄에 "추정가격: ..." 형태

## 출력 JSON 구조 (필수)

반드시 아래 키를 사용하는 JSON만 출력하세요:

{
  "발주기관": "발주 기관명",
  "공고명": "공고 제목",
  "공고번호": "공고 번호",
  "생성일시": "문서 기준 일시",
  "공사개요": [
    { "공사명": "...", "기초금액": "...", "공사기간": "...", "비고": "..." }
  ],
  "주요일정": [
    { "날짜": "2026.03.01", "단계": "공고일" },
    { "날짜": "2026.03.10 ~ 2026.03.20", "단계": "입찰서 접수" }
  ],
  "신청자격": [
    { "구분": "면허", "기준": "..." },
    { "구분": "실적", "기준": "..." }
  ],
  "담당자": { "부서": "...", "이름": "...", "연락처": "..." }
}

## 필드 작성 규칙
- 문서·표에 값이 있으면 "미기재" 금지
- 신청자격.기준, 공사개요.비고: 여러 항목은 **\n** 으로 구분 (DOCX에서 줄 단위로 렌더링됨)
- 주요일정: 시간순으로 배열. 공고일 → 입찰 접수 → 개찰 → 현장설명회 → 질의응답 순 권장
- 공사개요: 공사가 하나면 1행, 복수 공사면 행 추가
```

#### 소스 코드 (전체)

```typescript
/** Gemini 발주요약 — PDF 시각 분석 지시 (HWP→PDF 변환 첨부용) */

export const ORDER_REPORT_PDF_VISUAL_PROMPT = `## PDF 시각 분석 (최우선)

첨부된 PDF는 HWP 원본을 변환한 입찰 안내서입니다. **텍스트가 아닌 문서의 시각적 레이아웃(표, 글상자, 점선 테두리 목록)**을 분석하세요.

**반드시 수행할 작업:**
첨부된 PDF 문서의 **표(Table)** 에 기재된 다음 항목을 찾아 정확히 추출하세요.
- **추정가격**
- **예비가격기초금액**

「입찰에 부치는 사항」 등 2열 표에서 왼쪽 셀=항목명, 오른쪽 셀=금액(￦, ₩, 쉼표, 끝 하이픈 포함)인 경우가 많습니다.
표 셀 경계·병합·글상자 안 목록을 보고 항목명과 금액을 짝지어 읽으세요.

금액이 ￦414,328,730- (부가가치세 포함) 형태이면:
- JSON 공사개요.기초금액: "414,328,730원 (부가가치세 포함)" (천 단위 콤마 + 원 단위)
- 추정가격은 공사개요.비고에 "추정가격: 376,662,482원 (부가가치세 별도)" 형태로 기록

숫자 뒤 하이픈(-)은 마이너스가 아닙니다. 금액을 누락하지 마세요.`;

/** Gemini 발주요약 추출 프롬프트 (System Instruction) */

export const ORDER_REPORT_SUMMARY_PROMPT = `당신은 입찰 문서에서 핵심 금융 데이터를 오차 없이 추출하는 **정밀 데이터 추출기**입니다.
첨부 PDF·DOCX 등을 **시각적으로** 분석해 입찰 판단에 필요한 금융·일정·자격 정보를 누락 없이 추출합니다.

${ORDER_REPORT_PDF_VISUAL_PROMPT}

## 추정가격·예비가격기초금액 — 3단계 추출 규칙 (필수)

각 항목마다 아래 3단계를 **내부적으로 순서대로 적용(Thought)**한 뒤, 최종 결과만 JSON에 기록하세요.
(추론 과정은 출력하지 않고, response_schema JSON만 출력합니다.)

### [추출 규칙]
1. **원문 라인 복사(Verbatim)**: PDF 표에서 해당 단어가 포함된 **행/셀**을 원문 그대로 내부적으로 기록하세요.
2. **금액 숫자 추출**: 원화 기호·끝 하이픈(-) 제거 후 숫자만 사용
3. **표시 형식**: 천 단위 콤마(,) + **원** 단위 + 괄호 설명
   - "₩376,662,482-" → "376,662,482원 (부가가치세 별도)"
   - "￦414,328,730-" → "414,328,730원 (부가가치세 포함)"

### [금액 필드 매핑]
- 예비가격기초금액 → 공사개요[].기초금액
- 추정가격 → 공사개요[].비고 첫 줄에 "추정가격: ..." 형태

## 출력 JSON 구조 (필수)

반드시 아래 키를 사용하는 JSON만 출력하세요:

{
  "발주기관": "발주 기관명",
  "공고명": "공고 제목",
  "공고번호": "공고 번호",
  "생성일시": "문서 기준 일시",
  "공사개요": [
    { "공사명": "...", "기초금액": "...", "공사기간": "...", "비고": "..." }
  ],
  "주요일정": [
    { "날짜": "2026.03.01", "단계": "공고일" },
    { "날짜": "2026.03.10 ~ 2026.03.20", "단계": "입찰서 접수" }
  ],
  "신청자격": [
    { "구분": "면허", "기준": "..." },
    { "구분": "실적", "기준": "..." }
  ],
  "담당자": { "부서": "...", "이름": "...", "연락처": "..." }
}

## 필드 작성 규칙
- 문서·표에 값이 있으면 "미기재" 금지
- 신청자격.기준, 공사개요.비고: 여러 항목은 **\\n** 으로 구분 (DOCX에서 줄 단위로 렌더링됨)
- 주요일정: 시간순으로 배열. 공고일 → 입찰 접수 → 개찰 → 현장설명회 → 질의응답 순 권장
- 공사개요: 공사가 하나면 1행, 복수 공사면 행 추가`;
```

### 1.8 기본 모델

- 기본값: **`gemini-2.5-pro`** (`src/lib/gemini/config.ts`의 `GEMINI_DEFAULT_MODEL`)
- `GEMINI_MODEL` 환경변수로 변경 가능

---

## 2. DOCX 생성

### 2.1 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/order-report-summary/docx.ts` | **DOCX 빌더** — `docx` npm 패키지 사용 |
| `src/lib/order-report-summary/summaries.ts` | Gemini 요약 후 DOCX 생성·Storage 업로드·DB 저장 |
| `src/app/api/order-report-summaries/[noticeId]/download/route.ts` | DOCX 다운로드 API |

### 2.2 의존성

```json
"docx": "^9.7.1"
```

### 2.3 핵심 함수

#### `buildOrderReportSummaryDocx(notice, summary, generatedAt)`

**위치**: `src/lib/order-report-summary/docx.ts`

Gemini가 반환한 `OrderReportSummaryData`를 Word 문서로 변환합니다.

**문서 구성**:

| 섹션 | 내용 |
|------|------|
| 헤더 | 발주기관(큰 글씨), 공고명, 생성일시 |
| 1. 발주자 | 담당자 표 (부서 / 담당자 / 연락처) |
| 2. 공사개요 | 4열 표 (공사명, 기초금액, 공사기간, 비고) |
| 3. 주요일정 | 가로 플로우 표 (날짜 ▶ 단계 ▶ …) |
| 4. 신청자격 | 2열 표 (구분, 기준) |

**스타일**:
- 폰트: **맑은 고딕** (`Malgun Gothic`)
- 페이지: A4 (11906 × 16838 DXA), 여백 1440 DXA
- 헤더 색상: `#2E74B5`, 줄무늬(zebra) 배경 `#F2F2F2`
- `\n`으로 구분된 텍스트는 여러 Paragraph로 렌더링

반환값: `Promise<Buffer>` — `Packer.toBuffer(doc)` 결과

#### `buildOrderReportSummaryDocxFileName(notice)`

파일명 형식: `발주요약_{공고번호}_{YYYYMMDD}.docx`

### 2.4 저장·다운로드

**생성 시** (`summaries.ts` → `generateOrderReportSummary`):

1. `buildOrderReportSummaryDocx()`로 Buffer 생성
2. Supabase Storage 버킷 `order-report-summaries`에 업로드  
   - 경로: `{userId}/{noticeId}/summary.docx`
3. DB `user_order_report_summaries` 테이블에 JSON·파일명·모델 버전 저장

**다운로드 시** (`getOrderReportSummaryDocx`):

- Storage에서 Buffer 다운로드
- `GET /api/order-report-summaries/{noticeId}/download`로 파일 응답

---

## 3. 환경변수 설정

### 3.1 설정 파일 위치

프로젝트 루트에 **`.env.local`** 파일을 생성합니다. (`.env.example`은 없으며, `RUN.md`에 기본 Supabase·Auth 변수가 설명되어 있습니다.)

환경변수를 변경한 뒤에는 **개발 서버를 재시작**해야 반영됩니다.

### 3.2 Gemini (발주요약 필수)

**읽는 코드**: `src/lib/gemini/config.ts`

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `GEMINI_API_KEY` | **필수** | — | [Google AI Studio](https://aistudio.google.com/)에서 발급한 API 키 |
| `GEMINI_MODEL` | 선택 | `gemini-2.5-pro` | 사용할 Gemini 모델명 |
| `GEMINI_TLS_INSECURE` | 선택 | `false` | `true`이면 SSL 인증서 검증 우회 (사내 프록시 환경) |

```env
# Google AI Studio API 키 (발주요약 생성에 필수)
GEMINI_API_KEY=your-gemini-api-key

# 선택: 모델 변경
GEMINI_MODEL=gemini-2.5-pro

# 선택: 회사 프록시 SSL 오류 시
GEMINI_TLS_INSECURE=true
```

> `NODE_EXTRA_CA_CERTS`로 사내 CA 인증서를 지정하는 방법을 권장합니다. `GEMINI_TLS_INSECURE`는 개발·사내망 전용입니다.

### 3.3 HWP → PDF 변환 (HWP/HWPX 첨부 시)

**읽는 코드**: `src/lib/order-report-summary/hwp-to-pdf.ts`

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `HWP_CONVERT_PYTHON` | 선택 | Windows: `python` / Linux: `python3` | Python 실행 파일 경로 |
| `PYTHON` | 선택 | — | `HWP_CONVERT_PYTHON` 미설정 시 대체 |
| `HWP_TO_PDF_SCRIPT` | 선택 | `scripts/hwp_to_pdf.py` | 변환 스크립트 경로 |
| `HWP_PDF_BACKEND` | 선택 | `auto` | `auto` / `hwp` (한컴 win32com) / `libreoffice` |
| `HWP_PDF_TIMEOUT_MS` | 선택 | `120000` | 변환 타임아웃 (ms) |

```env
# Windows에서 Python 경로 지정 예시
HWP_CONVERT_PYTHON=C:\Users\you\AppData\Local\Programs\Python\Python312\python.exe

# Linux에서 LibreOffice 백엔드 강제
HWP_PDF_BACKEND=libreoffice
```

- **Windows**: 한컴오피스(HWP) win32com 사용 (`scripts/hwp_to_pdf.py`)
- **Linux**: LibreOffice headless 변환

### 3.4 Supabase (발주요약 저장·다운로드 필수)

**읽는 코드**: `src/lib/supabase/config.ts`

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 사용 시 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 사용 시 | 서버 API용 Service Role Key |

발주요약 기능 추가 요구사항:
- 마이그레이션: `supabase/migrations/009_user_order_report_summaries.sql`
- Storage 버킷: `order-report-summaries`
- 테이블: `user_order_report_summaries`

### 3.5 기타 (앱 공통)

**읽는 코드**: `RUN.md`, `src/lib/auth.ts` 등

| 변수 | 필수 | 설명 |
|------|------|------|
| `AUTH_SECRET` | 권장 | 로그인 세션 쿠키 서명 |

### 3.6 발주요약용 `.env.local` 예시

```env
# ── 인증 ──
AUTH_SECRET=your-secret-key-here

# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ── Gemini (발주요약) ──
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-pro

# ── HWP 변환 (선택) ──
# HWP_CONVERT_PYTHON=C:\...\python.exe
# HWP_PDF_BACKEND=auto
# HWP_PDF_TIMEOUT_MS=120000

# ── 프록시 SSL (선택) ──
# GEMINI_TLS_INSECURE=true
```

### 3.7 Config 모듈 요약

| 모듈 | 경로 | 역할 |
|------|------|------|
| Gemini | `src/lib/gemini/config.ts` | `getGeminiApiKey()`, `getGeminiModel()`, `isGeminiConfigured()` |
| 발주요약 | `src/lib/order-report-summary/config.ts` | LLM 타임아웃(120초), 기본 모델, 예산 정책 |
| Supabase | `src/lib/supabase/config.ts` | `isSupabaseConfigured()`, `getSupabaseConfigError()` |

---

## 4. API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/order-report-summaries/{noticeId}` | 요약 상태·JSON 조회 |
| `POST` | `/api/order-report-summaries/{noticeId}` | 요약 생성 (Gemini + DOCX) |
| `GET` | `/api/order-report-summaries/{noticeId}/download` | DOCX 파일 다운로드 |
| `GET` | `/api/order-report-summaries/status` | 여러 공고의 요약 상태 일괄 조회 |

---

## 5. 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| `GEMINI_API_KEY 환경 변수가 필요합니다` | `.env.local`에 `GEMINI_API_KEY` 설정 후 서버 재시작 |
| SSL 인증서 오류 | `GEMINI_TLS_INSECURE=true` 또는 `NODE_EXTRA_CA_CERTS` 설정 |
| `요약 가능한 첨부파일이 없습니다` | PDF/DOCX/TXT/HWP 형식인지, 20MB 이하인지 확인 |
| HWP 변환 실패 | Python·한컴오피스(Linux: LibreOffice) 설치, `HWP_CONVERT_PYTHON` 확인 |
| Storage/테이블 오류 | `009_user_order_report_summaries.sql` 마이그레이션 적용 |
| 요약 생성 타임아웃 | API route `maxDuration=120`, `ORDER_REPORT_SUMMARY_LLM_TIMEOUT_MS=120000` |
