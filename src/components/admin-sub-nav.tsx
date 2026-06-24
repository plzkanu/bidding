"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminSubNavItems } from "@/lib/nav";

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 sm:w-48">
      <p className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        관리자메뉴
      </p>
      <ul className="flex flex-row gap-2 sm:flex-col sm:gap-1">
        {adminSubNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#004b87] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
