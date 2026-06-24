import { AnnouncementsSubNav } from "@/components/announcements-sub-nav";

export default function BidInquiryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <AnnouncementsSubNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
