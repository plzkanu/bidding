"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BidNoticeAssignment } from "@/lib/bid-notices/assignments";
import type { Department } from "@/lib/departments";
import type { AssigneeUserOption } from "@/lib/assignee-users";

const selectClass =
  "w-full cursor-pointer rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-[#009ada] focus:ring-1 focus:ring-[#009ada]/20 disabled:cursor-not-allowed disabled:opacity-50";

const compactSelectClass =
  "w-full min-w-0 cursor-pointer rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] outline-none focus:border-[#009ada] focus:ring-1 focus:ring-[#009ada]/20 disabled:cursor-not-allowed disabled:opacity-50";

interface AssignmentHookOptions {
  noticeId: string;
  departments: Department[];
  assignment?: BidNoticeAssignment | null;
  onSaved?: (assignment: BidNoticeAssignment) => void;
  onError?: (message: string) => void;
}

function useBidNoticeAssignment({
  noticeId,
  departments,
  assignment,
  onSaved,
  onError,
}: AssignmentHookOptions) {
  const [departmentId, setDepartmentId] = useState(assignment?.departmentId ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState(
    assignment?.assigneeUserId ?? "",
  );
  const [assignees, setAssignees] = useState<AssigneeUserOption[]>([]);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const isMountedRef = useRef(true);
  const pendingSaveCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const activeDepartments = useMemo(
    () => departments.filter((row) => row.is_active),
    [departments],
  );

  const selectedDepartment = activeDepartments.find(
    (row) => row.id === departmentId,
  );

  useEffect(() => {
    setDepartmentId(assignment?.departmentId ?? "");
    setAssigneeUserId(assignment?.assigneeUserId ?? "");
    setLocalError("");
  }, [noticeId]);

  useEffect(() => {
    if (assignment == null || isSaving) return;
    if (assignment.noticeId !== noticeId) return;
    setDepartmentId(assignment.departmentId);
    setAssigneeUserId(assignment.assigneeUserId ?? "");
  }, [
    assignment,
    assignment?.assigneeUserId,
    assignment?.departmentId,
    assignment?.updatedAt,
    isSaving,
    noticeId,
  ]);

  const loadAssignees = useCallback(
    async (departmentName: string) => {
      setIsLoadingAssignees(true);
      try {
        const response = await fetch(
          `/api/assignee-users?department=${encodeURIComponent(departmentName)}`,
        );
        const data = (await response.json()) as {
          users?: AssigneeUserOption[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "담당자 목록을 불러오지 못했습니다.");
        }
        setAssignees(data.users ?? []);
      } catch (err) {
        setAssignees([]);
        const message =
          err instanceof Error
            ? err.message
            : "담당자 목록을 불러오지 못했습니다.";
        setLocalError(message);
        onError?.(message);
      } finally {
        setIsLoadingAssignees(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    if (!selectedDepartment) {
      setAssignees([]);
      return;
    }
    void loadAssignees(selectedDepartment.name);
  }, [loadAssignees, selectedDepartment]);

  useEffect(() => {
    if (!assigneeUserId || isLoadingAssignees) return;
    if (assignees.length === 0) return;
    if (!assignees.some((user) => user.id === assigneeUserId)) {
      setAssigneeUserId("");
    }
  }, [assigneeUserId, assignees, isLoadingAssignees]);

  const saveAssignment = useCallback(
    (next: { departmentId: string; assigneeUserId: string }) => {
      if (!next.departmentId) {
        const message = "담당부서를 선택해 주세요.";
        setLocalError(message);
        onError?.(message);
        return Promise.resolve();
      }

      pendingSaveCountRef.current += 1;
      setIsSaving(true);
      setLocalError("");

      const saveTask = saveChainRef.current.then(async () => {
        const response = await fetch("/api/bid-notice-assignments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noticeId,
            departmentId: next.departmentId,
            assigneeUserId: next.assigneeUserId || null,
          }),
        });
        const data = (await response.json()) as {
          assignment?: BidNoticeAssignment;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "담당 지정 저장에 실패했습니다.");
        }
        return data.assignment ?? null;
      });

      saveChainRef.current = saveTask.catch(() => undefined);

      void saveTask
        .then((saved) => {
          if (!isMountedRef.current) return;
          if (saved) {
            setDepartmentId(saved.departmentId);
            setAssigneeUserId(saved.assigneeUserId ?? "");
            onSaved?.(saved);
          }
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          const message =
            err instanceof Error ? err.message : "담당 지정 저장에 실패했습니다.";
          setLocalError(message);
          onError?.(message);
        })
        .finally(() => {
          pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
          if (pendingSaveCountRef.current === 0 && isMountedRef.current) {
            setIsSaving(false);
          }
        });
    },
    [noticeId, onError, onSaved],
  );

  function handleDepartmentChange(nextDepartmentId: string) {
    const nextAssigneeUserId = "";
    setDepartmentId(nextDepartmentId);
    setAssigneeUserId(nextAssigneeUserId);
    setLocalError("");
    if (nextDepartmentId) {
      saveAssignment({
        departmentId: nextDepartmentId,
        assigneeUserId: nextAssigneeUserId,
      });
    }
  }

  function handleAssigneeChange(nextAssigneeUserId: string) {
    setAssigneeUserId(nextAssigneeUserId);
    setLocalError("");
    if (departmentId) {
      saveAssignment({
        departmentId,
        assigneeUserId: nextAssigneeUserId,
      });
    }
  }

  return {
    activeDepartments,
    departmentId,
    assigneeUserId,
    assignees,
    isLoadingAssignees,
    isSaving,
    localError,
    handleDepartmentChange,
    handleAssigneeChange,
  };
}

interface BidNoticeAssignmentFieldsProps extends AssignmentHookOptions {
  compact?: boolean;
}

export function BidNoticeAssignmentFields({
  compact = false,
  ...options
}: BidNoticeAssignmentFieldsProps) {
  const {
    activeDepartments,
    departmentId,
    assigneeUserId,
    assignees,
    isLoadingAssignees,
    isSaving,
    localError,
    handleDepartmentChange,
    handleAssigneeChange,
  } = useBidNoticeAssignment(options);

  if (activeDepartments.length === 0) {
    return (
      <p className={compact ? "text-[10px] text-slate-400" : "text-xs text-slate-500"}>
        등록된 부서가 없습니다.
      </p>
    );
  }

  const selectCls = compact ? compactSelectClass : selectClass;

  return (
    <div className={compact ? "space-y-1" : "space-y-3"}>
      <div>
        {!compact ? (
          <label className="mb-1 block text-xs font-medium text-slate-600">
            담당부서 <span className="text-red-500">*</span>
          </label>
        ) : null}
        <select
          value={departmentId}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          disabled={isSaving}
          className={selectCls}
          aria-label="담당부서"
        >
          <option value="">선택</option>
          {activeDepartments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        {!compact ? (
          <label className="mb-1 block text-xs font-medium text-slate-600">
            담당자
          </label>
        ) : null}
        <select
          value={assigneeUserId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          disabled={
            !departmentId ||
            isSaving ||
            isLoadingAssignees ||
            assignees.length === 0
          }
          className={selectCls}
          aria-label="담당자"
        >
          <option value="">
            {!departmentId
              ? "부서 선택 후"
              : isLoadingAssignees
                ? "불러오는 중…"
                : assignees.length === 0
                  ? "담당자 없음"
                  : "선택 안 함"}
          </option>
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {localError ? (
        <p className={compact ? "text-[10px] text-red-600" : "text-xs text-red-600"}>
          {localError}
        </p>
      ) : null}
      {!compact && isSaving ? (
        <p className="text-xs text-slate-400">저장 중…</p>
      ) : null}
    </div>
  );
}

interface BidNoticeAssignmentTableCellsProps extends AssignmentHookOptions {
  deptColClass: string;
  assigneeColClass: string;
}

export function BidNoticeAssignmentTableCells({
  deptColClass,
  assigneeColClass,
  ...options
}: BidNoticeAssignmentTableCellsProps) {
  const {
    activeDepartments,
    departmentId,
    assigneeUserId,
    assignees,
    isLoadingAssignees,
    isSaving,
    localError,
    handleDepartmentChange,
    handleAssigneeChange,
  } = useBidNoticeAssignment(options);

  if (activeDepartments.length === 0) {
    return (
      <>
        <td className={deptColClass} colSpan={2}>
          <span className="text-[10px] text-slate-400">부서 미등록</span>
        </td>
      </>
    );
  }

  return (
    <>
      <td
        className={deptColClass}
        data-no-row-click
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <select
          value={departmentId}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          disabled={isSaving}
          className={compactSelectClass}
          aria-label="담당부서"
        >
          <option value="">선택</option>
          {activeDepartments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        {localError ? (
          <p className="mt-0.5 text-[10px] text-red-600">{localError}</p>
        ) : null}
      </td>
      <td
        className={assigneeColClass}
        data-no-row-click
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <select
          value={assigneeUserId}
          onChange={(e) => handleAssigneeChange(e.target.value)}
          disabled={
            !departmentId ||
            isSaving ||
            isLoadingAssignees ||
            assignees.length === 0
          }
          className={compactSelectClass}
          aria-label="담당자"
        >
          <option value="">
            {!departmentId
              ? "—"
              : isLoadingAssignees
                ? "…"
                : assignees.length === 0
                  ? "없음"
                  : "선택"}
          </option>
          {assignees.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}
