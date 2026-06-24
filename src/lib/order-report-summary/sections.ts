export const SUMMARY_CANCELLED_MESSAGE = "사용자가 요약 생성을 취소했습니다.";

export type OrderReportSummaryStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export const ORDER_REPORT_SUMMARY_STATUS_LABELS: Record<
  OrderReportSummaryStatus,
  string
> = {
  NOT_STARTED: "미생성",
  PENDING: "대기",
  PROCESSING: "생성 중",
  COMPLETED: "완료",
  FAILED: "실패",
};

export interface OrderReportSummarySection {
  id: string;
  title: string;
  description: string;
  fields: string[];
}

export const ORDER_REPORT_SUMMARY_SECTIONS: OrderReportSummarySection[] = [
  {
    id: "project_name",
    title: "I. 공사명",
    description: "공사·용역 명칭",
    fields: ["공사명"],
  },
  {
    id: "overview",
    title: "II. 공사개요",
    description: "발주자, 금액, 기간, 내용 및 하위 표",
    fields: [
      "발주자",
      "기초금액",
      "공사기간",
      "공사내용",
      "대상설비",
      "설비현황",
      "공사범위",
      "투입인력",
    ],
  },
  {
    id: "schedule",
    title: "III. 입찰 일정",
    description: "문서에 기재된 입찰 일정 (시간순)",
    fields: ["입찰공고", "PQ서류 제출", "입찰참가", "입찰서 제출", "개찰"],
  },
  {
    id: "qualification",
    title: "IV. 입찰참가자격",
    description: "면허, 실적, 공동·하도급 등 참가 자격",
    fields: ["면허", "실적", "유자격", "공동·하도급", "기타"],
  },
];

export const UNDER_DEVELOPMENT_MESSAGE =
  "발주요약 자동 생성 기능은 현재 개발 중입니다. 곧 제공될 예정입니다.";
