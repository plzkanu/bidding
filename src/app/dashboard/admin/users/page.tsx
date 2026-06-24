import { AccountManagement } from "@/components/account-management";
import { getSessionUser } from "@/lib/auth";

export default async function UsersManagementPage() {
  const user = await getSessionUser();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">사용자관리</h1>
        <p className="mt-2 text-sm text-slate-600">
          시스템 사용자 계정을 등록·수정·삭제할 수 있습니다.
        </p>
      </div>
      <AccountManagement currentUserId={user!.id} />
    </div>
  );
}
