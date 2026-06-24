import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

function LoginFormFallback() {
  return (
    <div className="flex h-64 w-full max-w-md items-center justify-center rounded-2xl bg-white text-sm text-slate-500">
      로딩 중...
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-slate-100 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#a4ce3920,_transparent_45%),radial-gradient(circle_at_bottom_left,_#009ada18,_transparent_40%)]"
      />
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
