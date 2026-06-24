export function SupabaseConfigAlert() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">Supabase 연결 설정이 필요합니다</p>
      <p className="mt-2 text-amber-800">
        프로젝트 루트에 <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
        파일을 만들고 아래 값을 입력한 뒤 개발 서버를 재시작해 주세요.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-white/80 p-3 text-xs text-slate-700">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`}
      </pre>
      <p className="mt-2 text-xs text-amber-700">
        Supabase 대시보드 → Project Settings → API에서 URL과 키를 확인할 수
        있습니다.
      </p>
    </div>
  );
}
