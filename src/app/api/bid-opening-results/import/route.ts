import { NextResponse } from "next/server";
import { getApiSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  buildBidOpeningResultsCsvTemplate,
  buildBidOpeningResultsXlsxTemplate,
  importBidOpeningResultsFromFile,
  isCsvFileName,
  isXlsxFileName,
} from "@/lib/bid-opening-results-csv";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

function supabaseNotConfiguredResponse() {
  return NextResponse.json(
    { error: getSupabaseConfigError() ?? "Supabase가 설정되지 않았습니다." },
    { status: 503 },
  );
}

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/csv",
  "text/plain",
]);

function isAllowedImportFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (isCsvFileName(lowerName) || isXlsxFileName(lowerName)) {
    return true;
  }
  if (XLSX_MIME_TYPES.has(file.type) || CSV_MIME_TYPES.has(file.type)) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  const session = await getApiSession();
  if (!session) {
    return unauthorizedResponse();
  }
  if (!isSupabaseConfigured()) {
    return supabaseNotConfiguredResponse();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "업로드할 파일을 선택해 주세요." },
        { status: 400 },
      );
    }

    if (!isAllowedImportFile(file)) {
      return NextResponse.json(
        { error: "CSV 또는 Excel(xlsx) 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    const result = await importBidOpeningResultsFromFile(
      buffer,
      file.name,
      session.id,
    );

    if (result.created === 0 && result.errors.length > 0) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "파일 업로드에 실패했습니다." },
      { status: 500 },
    );
  }
}
