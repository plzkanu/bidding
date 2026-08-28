export interface PageVisitStat {
  screenKey: string;
  screenLabel: string;
  visitCount: number;
  lastVisitedAt: string;
}

export interface UserUsageSummary {
  userId: string;
  name: string;
  department: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  totalActiveSeconds: number;
  sessionCount: number;
  pageVisits: PageVisitStat[];
}
