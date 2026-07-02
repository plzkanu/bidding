"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import {
  announcementsSubNavItems,
  mainNavItems,
  openingResultsSubNavItems,
} from "@/lib/nav";
import type { SessionUser } from "@/lib/types";

interface AppSidebarProps {
  user: SessionUser;
}

const NAV_ICONS: Record<string, string> = {
  "/dashboard": "📊",
  "/dashboard/announcements": "📢",
  "/dashboard/favorites": "⭐",
  "/dashboard/order-report": "📋",
  "/dashboard/bid": "📁",
  "/dashboard/estimate": "🧮",
  "/dashboard/results": "📈",
  "/dashboard/opening-results": "🏆",
  "/dashboard/admin": "⚙️",
};

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (href === "/dashboard/admin") {
    return pathname.startsWith("/dashboard/admin");
  }
  if (href === "/dashboard/announcements") {
    return announcementsSubNavItems.some(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
  }
  if (href === "/dashboard/opening-results") {
    return openingResultsSubNavItems.some(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const items = mainNavItems.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );
  const initial = user.name.trim().charAt(0) || user.id.charAt(0);

  return (
    <aside className="fixed top-0 left-0 z-[100] flex h-screen w-[220px] flex-col bg-[#0F2645]">
      <div className="border-b border-white/8 px-[18px] pt-5 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-white px-3 py-2"
          aria-label="대시보드 홈"
        >
          <Image
            src="/images/soosan-logo.png"
            alt="SOOSAN"
            width={140}
            height={40}
            className="h-8 w-auto shrink-0 object-contain"
            priority
          />
        </Link>
        <p className="mt-2 text-[11px] text-[#BCC0C8]">입찰·견적 관리 시스템</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <p className="px-[18px] pt-2 pb-1 text-[10px] font-medium tracking-[0.08em] text-[#BCC0C8] uppercase">
          메뉴
        </p>
        {items.map((item) => {
          const isActive = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2.5 px-[18px] py-2.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-[#1E5FD4]/25 font-medium text-white"
                  : "font-normal text-white/65 hover:bg-white/6 hover:text-white"
              }`}
            >
              {isActive ? (
                <span
                  className="absolute top-0 bottom-0 left-0 w-[3px] rounded-r-sm bg-[#1E5FD4]"
                  aria-hidden
                />
              ) : null}
              <span className="w-[18px] text-center text-[15px]">
                {NAV_ICONS[item.href] ?? "•"}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/8 px-[18px] py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1E5FD4] text-[13px] font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">
              {user.name}
            </p>
            <p className="truncate text-[11px] text-[#BCC0C8]">
              {[user.department, user.id].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <LogoutButton className="w-full rounded-md border border-white/15 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-60" />
        </div>
      </div>
    </aside>
  );
}
