"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!userId.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          password,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "로그인에 실패했습니다.");
        return;
      }

      const from = searchParams.get("from");
      router.push(
        from && from.startsWith("/dashboard") ? from : "/dashboard",
      );
      router.refresh();
    } catch {
      setError("로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <div className="mb-8 flex w-full justify-center px-4">
        <Image
          src="/images/soosan-logo.png"
          alt="SOOSAN"
          width={280}
          height={80}
          priority
          className="h-auto w-full max-w-[280px] object-contain"
        />
      </div>

      <div className="w-full rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-lg shadow-slate-200/60">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold tracking-tight text-[#004b87]">
            입찰 · 견적 시스템
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            시스템 이용을 위해 로그인해 주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="userId"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              아이디
            </label>
            <input
              id="userId"
              type="text"
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="아이디를 입력하세요"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#009ada] focus:ring-2 focus:ring-[#009ada]/20"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#004b87] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003a6a] focus:outline-none focus:ring-2 focus:ring-[#004b87]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        © SOOSAN. All rights reserved.
      </p>
    </div>
  );
}
