import { randomUUID } from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const ATTACHMENTS_BUCKET = "bid-notice-attachments";
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export const ATTACHMENTS_TABLE_SETUP_MESSAGE =
  "첨부파일을 사용할 수 없습니다. Supabase에 bid_notice_attachments 테이블이 필요합니다. supabase/migrations/007_bid_notice_attachments.sql을 적용해 주세요.";

export const ATTACHMENTS_STORAGE_SETUP_MESSAGE =
  "첨부파일 Storage 버킷(bid-notice-attachments)이 없습니다. supabase/migrations/007_bid_notice_attachments.sql을 적용해 주세요.";

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".dll",
  ".scr",
  ".ps1",
  ".vbs",
  ".js",
  ".jar",
]);

export interface BidNoticeAttachment {
  id: string;
  noticeId: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface BidNoticeAttachmentWithUrl extends BidNoticeAttachment {
  downloadUrl: string;
}

interface AttachmentFileRecord {
  fileName: string;
  mimeType: string | null;
  storagePath: string;
  fileSize: number;
}

export function buildAttachmentDownloadPath(
  noticeId: string,
  attachmentId: string,
): string {
  return `/api/bid-notices/${encodeURIComponent(noticeId)}/attachments/${encodeURIComponent(attachmentId)}/download`;
}

export function buildContentDisposition(fileName: string): string {
  const fallback =
    fileName
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .trim()
      .slice(0, 200) || "download";
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function isMissingAttachmentsTableError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("bid_notice_attachments") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find the table"))
  );
}

function isMissingStorageBucketError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes("bid-notice-attachments") ||
    message.includes("Bucket not found") ||
    message.includes("bucket")
  );
}

export function normalizeAttachmentsError(message: string | undefined): string {
  if (isMissingAttachmentsTableError(message)) {
    return ATTACHMENTS_TABLE_SETUP_MESSAGE;
  }
  if (isMissingStorageBucketError(message)) {
    return ATTACHMENTS_STORAGE_SETUP_MESSAGE;
  }
  return message?.trim() || "첨부파일 처리에 실패했습니다.";
}

function supabaseNotReadyError(): string | null {
  if (!isSupabaseConfigured()) {
    return "Supabase가 설정되지 않아 첨부파일을 사용할 수 없습니다.";
  }
  return null;
}

/** 화면·다운로드용 원본 파일명 (한글 유지) */
export function getDisplayFileName(fileName: string): string {
  const trimmed = fileName.replace(/[/\\?%*:|"<>]/g, "_").trim();
  return trimmed.slice(0, 200) || "file";
}

function getFileExtension(fileName: string): string {
  const base = fileName.replace(/[/\\]/g, "").trim();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  const ext = base.slice(dot).toLowerCase();
  if (!/^\.[a-z0-9]{1,12}$/.test(ext)) return "";
  return ext;
}

/** Supabase Storage 키: ASCII만 사용 (한글·공백 불가) */
export function buildStorageObjectKey(
  noticeId: string,
  attachmentId: string,
  fileName: string,
): string {
  const ext = getFileExtension(fileName);
  return `${noticeId}/${attachmentId}${ext}`;
}

export function validateAttachmentFile(
  fileName: string,
  fileSize: number,
): string | null {
  if (!fileName.trim()) {
    return "파일 이름이 없습니다.";
  }
  if (fileSize <= 0) {
    return "빈 파일은 업로드할 수 없습니다.";
  }
  if (fileSize > ATTACHMENT_MAX_BYTES) {
    return `파일 크기는 ${Math.floor(ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`;
  }

  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return "허용되지 않는 파일 형식입니다.";
  }

  return null;
}

function mapAttachmentRow(row: {
  id: string;
  notice_id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}): BidNoticeAttachment {
  return {
    id: row.id,
    noticeId: row.notice_id,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

async function assertNoticeExists(noticeId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("khnp_bid_notice")
    .select("id")
    .eq("id", noticeId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    return normalizeAttachmentsError(error.message);
  }
  if (!data) {
    return "공고를 찾을 수 없습니다.";
  }
  return null;
}

export async function listNoticeAttachments(
  noticeId: string,
): Promise<{ attachments: BidNoticeAttachmentWithUrl[]; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { attachments: [], error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_attachments")
      .select(
        "id, notice_id, file_name, file_size, mime_type, uploaded_by, created_at, storage_path",
      )
      .eq("notice_id", noticeId)
      .order("created_at", { ascending: false });

    if (error) {
      return { attachments: [], error: normalizeAttachmentsError(error.message) };
    }

    const attachments: BidNoticeAttachmentWithUrl[] = (data ?? []).map((row) => {
      const id = row.id as string;
      return {
        ...mapAttachmentRow({
          id,
          notice_id: row.notice_id as string,
          file_name: row.file_name as string,
          file_size: row.file_size as number,
          mime_type: (row.mime_type as string | null) ?? null,
          uploaded_by: row.uploaded_by as string,
          created_at: row.created_at as string,
        }),
        downloadUrl: buildAttachmentDownloadPath(noticeId, id),
      };
    });

    return { attachments, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "첨부파일 목록 조회에 실패했습니다.";
    return { attachments: [], error: normalizeAttachmentsError(message) };
  }
}

export async function addNoticeAttachment(
  noticeId: string,
  uploadedBy: string,
  fileName: string,
  mimeType: string | null,
  fileBuffer: Buffer,
): Promise<{ attachment: BidNoticeAttachment | null; error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { attachment: null, error: configError };
  }

  const validationError = validateAttachmentFile(fileName, fileBuffer.byteLength);
  if (validationError) {
    return { attachment: null, error: validationError };
  }

  const noticeError = await assertNoticeExists(noticeId);
  if (noticeError) {
    return { attachment: null, error: noticeError };
  }

  const attachmentId = randomUUID();
  const displayName = getDisplayFileName(fileName);
  const storagePath = buildStorageObjectKey(noticeId, attachmentId, fileName);

  try {
    const supabase = createServerClient();

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return { attachment: null, error: normalizeAttachmentsError(uploadError.message) };
    }

    const { data, error } = await supabase
      .from("bid_notice_attachments")
      .insert({
        id: attachmentId,
        notice_id: noticeId,
        file_name: displayName,
        storage_path: storagePath,
        file_size: fileBuffer.byteLength,
        mime_type: mimeType,
        uploaded_by: uploadedBy,
      })
      .select(
        "id, notice_id, file_name, file_size, mime_type, uploaded_by, created_at",
      )
      .single();

    if (error) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
      return { attachment: null, error: normalizeAttachmentsError(error.message) };
    }

    return {
      attachment: mapAttachmentRow({
        id: data.id as string,
        notice_id: data.notice_id as string,
        file_name: data.file_name as string,
        file_size: data.file_size as number,
        mime_type: (data.mime_type as string | null) ?? null,
        uploaded_by: data.uploaded_by as string,
        created_at: data.created_at as string,
      }),
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "첨부파일 업로드에 실패했습니다.";
    return { attachment: null, error: normalizeAttachmentsError(message) };
  }
}

export async function getNoticeAttachmentFile(
  noticeId: string,
  attachmentId: string,
): Promise<{
  file: AttachmentFileRecord | null;
  buffer: Buffer | null;
  error: string | null;
}> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { file: null, buffer: null, error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_attachments")
      .select("file_name, mime_type, storage_path, file_size")
      .eq("id", attachmentId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { file: null, buffer: null, error: normalizeAttachmentsError(error.message) };
    }
    if (!data) {
      return { file: null, buffer: null, error: "첨부파일을 찾을 수 없습니다." };
    }

    const file: AttachmentFileRecord = {
      fileName: data.file_name as string,
      mimeType: (data.mime_type as string | null) ?? null,
      storagePath: data.storage_path as string,
      fileSize: Number(data.file_size),
    };

    const { data: blob, error: downloadError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .download(file.storagePath);

    if (downloadError || !blob) {
      return {
        file: null,
        buffer: null,
        error: normalizeAttachmentsError(downloadError?.message),
      };
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    return { file, buffer, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "첨부파일 다운로드에 실패했습니다.";
    return { file: null, buffer: null, error: normalizeAttachmentsError(message) };
  }
}

export async function removeNoticeAttachment(
  noticeId: string,
  attachmentId: string,
): Promise<{ error: string | null }> {
  const configError = supabaseNotReadyError();
  if (configError) {
    return { error: configError };
  }

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("bid_notice_attachments")
      .select("id, storage_path")
      .eq("id", attachmentId)
      .eq("notice_id", noticeId)
      .maybeSingle();

    if (error) {
      return { error: normalizeAttachmentsError(error.message) };
    }
    if (!data) {
      return { error: "첨부파일을 찾을 수 없습니다." };
    }

    const { error: storageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([data.storage_path as string]);

    if (storageError) {
      return { error: normalizeAttachmentsError(storageError.message) };
    }

    const { error: deleteError } = await supabase
      .from("bid_notice_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("notice_id", noticeId);

    if (deleteError) {
      return { error: normalizeAttachmentsError(deleteError.message) };
    }

    return { error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "첨부파일 삭제에 실패했습니다.";
    return { error: normalizeAttachmentsError(message) };
  }
}
