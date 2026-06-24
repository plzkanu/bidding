"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ATTACHMENT_MAX_BYTES } from "@/lib/bid-notices/attachments";

interface AttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  uploadedBy: string;
  createdAt: string;
  downloadUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BidNoticeAttachmentsPanel({
  noticeId,
  embedded = false,
}: {
  noticeId: string;
  embedded?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadAttachments = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [attachmentsRes, meRes] = await Promise.all([
        fetch(`/api/bid-notices/${encodeURIComponent(noticeId)}/attachments`),
        fetch("/api/auth/me"),
      ]);

      const attachmentsData = (await attachmentsRes.json()) as {
        attachments?: AttachmentItem[];
        error?: string;
      };
      const meData = (await meRes.json()) as {
        user?: { role?: string };
      };

      if (!attachmentsRes.ok) {
        throw new Error(
          attachmentsData.error ?? "첨부파일 목록을 불러오지 못했습니다.",
        );
      }

      setAttachments(attachmentsData.attachments ?? []);
      setIsAdmin(meRes.ok && meData.user?.role === "admin");
    } catch (err) {
      setAttachments([]);
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [noticeId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > ATTACHMENT_MAX_BYTES) {
      setError(
        `파일 크기는 ${Math.floor(ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
      );
      return;
    }

    setIsUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/bid-notices/${encodeURIComponent(noticeId)}/attachments`,
        { method: "POST", body: formData },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "첨부파일 업로드에 실패했습니다.");
      }

      await loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(attachmentId: string) {
    setDeletingId(attachmentId);
    setError("");
    try {
      const response = await fetch(
        `/api/bid-notices/${encodeURIComponent(noticeId)}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "첨부파일 삭제에 실패했습니다.");
      }

      setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부파일 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  const sectionClass = embedded
    ? ""
    : "mt-6 border-t border-slate-100 pt-6";

  return (
    <section className={sectionClass}>
      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">첨부파일</h3>
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg border border-[#004b87]/30 px-3 py-1.5 text-xs font-semibold text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
              >
                {isUploading ? "업로드 중…" : "파일 업로드"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isAdmin ? (
            <div className="ml-auto flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-lg border border-[#004b87]/30 px-3 py-1.5 text-xs font-semibold text-[#004b87] hover:bg-[#004b87]/5 disabled:opacity-40"
              >
                {isUploading ? "업로드 중…" : "파일 업로드"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {isAdmin ? (
        <p className="mt-1 text-xs text-slate-500">
          관리자만 공고별 첨부파일을 등록·삭제할 수 있습니다. (최대{" "}
          {Math.floor(ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB)
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          등록된 첨부파일을 다운로드할 수 있습니다.
        </p>
      )}

      {isLoading ? (
        <p className={`text-sm text-slate-400 ${embedded ? "" : "mt-3"}`}>
          첨부파일 불러오는 중…
        </p>
      ) : attachments.length === 0 ? (
        <p
          className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-400 ${embedded ? "" : "mt-3"}`}
        >
          등록된 첨부파일이 없습니다.
        </p>
      ) : (
        <ul
          className={`divide-y divide-slate-100 rounded-xl border border-slate-200 ${embedded ? "" : "mt-3"}`}
        >
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={attachment.downloadUrl}
                  download={attachment.fileName}
                  className="text-sm font-medium text-[#004b87] underline-offset-2 hover:underline"
                >
                  {attachment.fileName}
                </a>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatFileSize(attachment.fileSize)}
                  {attachment.uploadedBy ? ` · ${attachment.uploadedBy}` : ""}
                  {attachment.createdAt
                    ? ` · ${formatUploadedAt(attachment.createdAt)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={attachment.downloadUrl}
                  download={attachment.fileName}
                  className="rounded-lg bg-[#004b87] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#003d6e]"
                >
                  다운로드
                </a>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(attachment.id)}
                    disabled={deletingId === attachment.id}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    {deletingId === attachment.id ? "삭제 중…" : "삭제"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
