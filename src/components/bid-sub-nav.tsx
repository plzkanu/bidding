"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bidSubNavItems } from "@/lib/nav";

function isBidSubNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BidSubNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 sm:w-44">
      <p className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        입찰하기
      </p>
      <ul className="flex flex-row gap-2 sm:flex-col sm:gap-1">
        {bidSubNavItems.map((item) => {
          const isActive = isBidSubNavActive(pathname, item.href);

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
