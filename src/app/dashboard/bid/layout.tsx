import { BidSubNav } from "@/components/bid-sub-nav";

export default function BidLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <BidSubNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
