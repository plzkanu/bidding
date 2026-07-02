import { OpeningResultsSubNav } from "@/components/opening-results-sub-nav";

export default function OpeningResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <OpeningResultsSubNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
