import { SessionTimeoutSettings } from "@/components/session-timeout-settings";

export default function SessionSettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#004b87]">세션 설정</h1>
        <p className="mt-2 text-sm text-slate-600">
          사용자 미사용 타임아웃 등 세션 관련 설정을 관리합니다.
        </p>
      </div>
      <SessionTimeoutSettings />
    </div>
  );
}
