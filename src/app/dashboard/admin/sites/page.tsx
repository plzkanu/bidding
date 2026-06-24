import { redirect } from "next/navigation";

export default function SitesRedirectPage() {
  redirect("/dashboard/admin/crawl-sites");
}
