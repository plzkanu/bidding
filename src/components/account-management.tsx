"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { UserPublic, UserRole } from "@/lib/types";
import type { Department } from "@/lib/departments";

interface AccountManagementProps {
  currentUserId: string;
}

type FormMode = "create" | "edit" | null;

interface AccountFormState {
  id: string;
  password: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
}

const emptyForm: AccountFormState = {
  id: "",
  password: "",
  name: "",
  department: "",
  role: "user",
  active: true,
};

const roleLabels: Record<UserRole, string> = {
  admin: "관리자",
  user: "일반",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function AccountManagement({ currentUserId }: AccountManagementProps) {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [usersRes, departmentsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments?activeOnly=true"),
      ]);
      const data = (await usersRes.json()) as {
        users?: UserPublic[];
        error?: string;
      };
      const departmentsData = (await departmentsRes.json()) as {
        departments?: Department[];
        error?: string;
      };
      if (!usersRes.ok) {
        throw new Error(data.error ?? "계정 목록을 불러오지 못했습니다.");
      }
      setUsers(data.users ?? []);
      setDepartments(departmentsData.departments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreateForm() {
    setFormMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function openEditForm(user: UserPublic) {
    setFormMode("edit");
    setEditingId(user.id);
    setForm({
      id: user.id,
      password: "",
      name: user.name,
      department: user.department,
      role: user.role,
      active: user.active,
    });
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

    try {
      if (formMode === "create") {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: form.id,
            password: form.password,
            name: form.name,
            department: form.department,
            role: form.role,
            active: form.active,
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "계정 생성에 실패했습니다.");
        }
      } else if (formMode === "edit" && editingId) {
        const response = await fetch(`/api/users/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            department: form.department,
            role: form.role,
            active: form.active,
            password: form.password || undefined,
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "계정 수정에 실패했습니다.");
        }
      }

      closeForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(user: UserPublic) {
    if (!confirm(`'${user.id}' 계정을 삭제하시겠습니까?`)) {
      return;
    }

    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "계정 삭제에 실패했습니다.");
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          총 <span className="font-semibold text-slate-700">{users.length}</span>
          개 계정
        </p>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003a6a]"
        >
          사용자 추가
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
            계정 목록을 불러오는 중...
          </p>
        ) : users.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            등록된 계정이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">아이디</th>
                  <th className="px-4 py-3 font-medium">이름</th>
                  <th className="px-4 py-3 font-medium">부서</th>
                  <th className="px-4 py-3 font-medium">역할</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">생성일</th>
                  <th className="px-4 py-3 font-medium text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {user.id}
                      {user.id === currentUserId ? (
                        <span className="ml-2 text-xs text-[#009ada]">
                          (나)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{user.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.department || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-[#004b87]/10 text-[#004b87]"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          user.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {user.active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(user)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={user.id === currentUserId || user.id === "admin"}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#004b87]">
              {formMode === "create" ? "사용자 추가" : "사용자 수정"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {formMode === "create" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    아이디
                  </label>
                  <input
                    type="text"
                    required
                    value={form.id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, id: e.target.value }))
                    }
                    placeholder="영문, 숫자"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    아이디
                  </label>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {form.id}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  이름
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  부서
                </label>
                <select
                  value={form.department}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      department: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                >
                  <option value="">선택 안 함</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {departments.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    등록된 활성 부서가 없습니다. 관리자메뉴 → 부서관리에서
                    먼저 등록해 주세요.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {formMode === "create" ? "비밀번호" : "비밀번호 (변경 시만)"}
                </label>
                <input
                  type="password"
                  required={formMode === "create"}
                  value={form.password}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder={
                    formMode === "edit" ? "변경하지 않으면 비워 두세요" : ""
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    역할
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        role: e.target.value as UserRole,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  >
                    <option value="user">일반</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    상태
                  </label>
                  <select
                    value={form.active ? "active" : "inactive"}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        active: e.target.value === "active",
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
                  >
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
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
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-[#004b87] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003a6a] disabled:opacity-60"
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
