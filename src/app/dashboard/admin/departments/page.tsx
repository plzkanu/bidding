import { DepartmentManagement } from "@/components/department-management";

export default function AdminDepartmentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#004b87]">부서관리</h1>
      <p className="mt-2 text-sm text-slate-600">
        담당부서 지정과 사용자 계정에 사용할 부서를 등록·관리합니다.
      </p>
      <div className="mt-6">
        <DepartmentManagement />
      </div>
    </div>
  );
}
