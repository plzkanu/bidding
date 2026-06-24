"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { announcementsSubNavItems, mainNavItems } from "@/lib/nav";
import type { SessionUser } from "@/lib/types";

interface AppNavProps {
  user: SessionUser;
}

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
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();

  const items = mainNavItems.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-app gap-1 px-4">
        {items.map((item) => {
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition ${
                isActive
                  ? "border-[#004b87] text-[#004b87]"
                  : "border-transparent text-slate-600 hover:text-[#004b87]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
