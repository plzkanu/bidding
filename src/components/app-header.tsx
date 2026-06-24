import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "./logout-button";
import type { SessionUser } from "@/lib/types";

interface AppHeaderProps {
  user: SessionUser;
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-app items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Image
            src="/images/soosan-logo.png"
            alt="SOOSAN"
            width={140}
            height={40}
            className="h-8 w-auto shrink-0 object-contain"
          />
          <span className="hidden text-sm font-medium text-slate-500 sm:inline">
            입찰 · 견적 시스템
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden text-sm text-slate-600 sm:inline">
            {user.name}
            {user.department ? (
              <span className="ml-1 text-slate-500">{user.department}</span>
            ) : null}
            <span className="ml-1 text-slate-400">({user.id})</span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
