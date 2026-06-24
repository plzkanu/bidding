"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CrawlSite } from "@/lib/crawl-sites";

interface CrawlSiteFormState {
  site_code: string;
  site_name: string;
  site_url: string;
  site_category: string;
  org_type: string;
  region: string;
  is_active: boolean;
  note: string;
}

const emptyForm: CrawlSiteFormState = {
  site_code: "",
  site_name: "",
  site_url: "",
  site_category: "",
  org_type: "",
  region: "",
  is_active: true,
  note: "",
};

type FormMode = "create" | "edit" | null;

function siteToForm(site: CrawlSite): CrawlSiteFormState {
  return {
    site_code: site.site_code,
    site_name: site.site_name,
    site_url: site.site_url,
    site_category: site.site_category ?? "",
    org_type: site.org_type ?? "",
    region: site.region ?? "",
    is_active: site.is_active ?? true,
    note: site.note ?? "",
  };
}

export function CrawlSiteManagement() {
  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CrawlSiteFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const loadSites = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/crawl-sites?includeInactive=true");
      const data = (await response.json()) as {
        sites?: CrawlSite[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "사이트 목록을 불러오지 못했습니다.");
      }
      setSites(data.sites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  function openCreateForm() {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function openEditForm(site: CrawlSite) {
    setFormMode("edit");
    setEditingId(site.id);
    setForm(siteToForm(site));
    setError("");
  }

  function closeForm() {
    setFormMode(null);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    const payload = {
      site_code: form.site_code,
      site_name: form.site_name,
      site_url: form.site_url,
      site_category: form.site_category || null,
      org_type: form.org_type || null,
      region: form.region || null,
      is_active: form.is_active,
      note: form.note || null,
    };

    try {
      if (formMode === "create") {
        const response = await fetch("/api/crawl-sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "사이트 등록에 실패했습니다.");
        }
      } else if (formMode === "edit" && editingId !== null) {
        const response = await fetch(`/api/crawl-sites/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "사이트 수정에 실패했습니다.");
        }
      }

      closeForm();
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(site: CrawlSite) {
    if (!confirm(`'${site.site_name}' 사이트를 삭제하시겠습니까?`)) {
      return;
    }

    setError("");
    try {
      const response = await fetch(`/api/crawl-sites/${site.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "사이트 삭제에 실패했습니다.");
      }
      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          총 <span className="font-semibold text-slate-700">{sites.length}</span>
          개 사이트
        </p>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003a6a]"
        >
          사이트 추가
        </button>
      </div>

      {error && !formMode ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            목록을 불러오는 중...
          </p>
        ) : sites.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            등록된 사이트가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">사이트명</th>
                  <th className="px-4 py-3 font-medium">코드</th>
                  <th className="px-4 py-3 font-medium">분류</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {site.site_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{site.site_code}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {site.site_category ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          site.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {site.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(site)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(site)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#004b87]">
              {formMode === "create" ? "사이트 추가" : "사이트 수정"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <FormField
                label="사이트 코드"
                value={form.site_code}
                onChange={(v) => setForm((p) => ({ ...p, site_code: v }))}
                required
                disabled={formMode === "edit"}
              />
              <FormField
                label="사이트명"
                value={form.site_name}
                onChange={(v) => setForm((p) => ({ ...p, site_name: v }))}
                required
              />
              <FormField
                label="URL"
                value={form.site_url}
                onChange={(v) => setForm((p) => ({ ...p, site_url: v }))}
                required
                type="url"
              />
              <FormField
                label="분류"
                value={form.site_category}
                onChange={(v) => setForm((p) => ({ ...p, site_category: v }))}
              />
              <FormField
                label="기관유형"
                value={form.org_type}
                onChange={(v) => setForm((p) => ({ ...p, org_type: v }))}
              />
              <FormField
                label="지역"
                value={form.region}
                onChange={(v) => setForm((p) => ({ ...p, region: v }))}
              />
              <FormField
                label="비고"
                value={form.note}
                onChange={(v) => setForm((p) => ({ ...p, note: v }))}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  상태
                </label>
                <select
                  value={form.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      is_active: e.target.value === "active",
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </div>

              {error && formMode ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  required,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20 disabled:bg-slate-100"
      />
    </div>
  );
}
