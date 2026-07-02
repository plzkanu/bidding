"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openingResultsSubNavItems } from "@/lib/nav";

function isOpeningResultsSubNavActive(pathname: string, href: string) {
  if (href === "/dashboard/opening-results") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OpeningResultsSubNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 sm:w-44">
      <p className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        개찰결과
      </p>
      <ul className="flex flex-row gap-2 sm:flex-col sm:gap-1">
        {openingResultsSubNavItems.map((item) => {
          const isActive = isOpeningResultsSubNavActive(pathname, item.href);

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
