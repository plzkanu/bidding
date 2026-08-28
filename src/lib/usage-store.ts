import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatSupabaseNetworkError } from "@/lib/supabase/fetch";
import { resolveScreenKey, screenLabel } from "@/lib/usage-screens";
import type { PageVisitStat, UserUsageSummary } from "@/lib/usage-types";

export type { PageVisitStat, UserUsageSummary } from "@/lib/usage-types";

/** 하트비트 간격보다 조금 크게: 네트워크 지연 허용 */
const MAX_HEARTBEAT_CREDIT_SECONDS = 90;
/** 이보다 오래 비활성 세션이면 새 세션으로 간주 */
const SESSION_STALE_MS = 30 * 60 * 1000;

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  active_seconds: number;
}

interface VisitRow {
  user_id: string;
  screen_key: string;
  visit_count: number;
  last_visited_at: string;
}

interface UserRow {
  id: string;
  name: string;
  department: string;
  role: string;
  active: boolean;
  last_login_at: string | null;
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase가 설정되지 않았습니다. 사용량 데이터는 Supabase에 저장됩니다.",
    );
  }
}

export async function recordUserLogin(userId: string): Promise<void> {
  requireSupabase();
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("bid_users")
    .update({ last_login_at: now, updated_at: now })
    .eq("id", userId);

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }
}

export async function startOrResumeSession(
  userId: string,
  sessionId?: string | null,
): Promise<{ sessionId: string }> {
  requireSupabase();
  const supabase = createServerClient();
  const now = new Date();

  if (sessionId) {
    const { data, error } = await supabase
      .from("user_usage_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(formatSupabaseNetworkError(error.message));
    }

    const row = data as SessionRow | null;
    if (row && !row.ended_at) {
      const lastSeen = new Date(row.last_seen_at).getTime();
      if (now.getTime() - lastSeen < SESSION_STALE_MS) {
        const { error: touchError } = await supabase
          .from("user_usage_sessions")
          .update({ last_seen_at: now.toISOString() })
          .eq("id", row.id);
        if (touchError) {
          throw new Error(formatSupabaseNetworkError(touchError.message));
        }
        return { sessionId: row.id };
      }

      await supabase
        .from("user_usage_sessions")
        .update({ ended_at: row.last_seen_at })
        .eq("id", row.id);
    }
  }

  const { data: created, error: createError } = await supabase
    .from("user_usage_sessions")
    .insert({
      user_id: userId,
      started_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      active_seconds: 0,
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw new Error(
      formatSupabaseNetworkError(
        createError?.message ?? "세션을 시작하지 못했습니다.",
      ),
    );
  }

  return { sessionId: created.id as string };
}

export async function recordHeartbeat(
  userId: string,
  sessionId: string,
): Promise<{ sessionId: string; activeSeconds: number }> {
  requireSupabase();
  const supabase = createServerClient();
  const now = new Date();

  const { data, error } = await supabase
    .from("user_usage_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  let row = data as SessionRow | null;
  if (!row || row.ended_at) {
    const resumed = await startOrResumeSession(userId, null);
    return recordHeartbeat(userId, resumed.sessionId);
  }

  const lastSeen = new Date(row.last_seen_at).getTime();
  if (now.getTime() - lastSeen >= SESSION_STALE_MS) {
    await supabase
      .from("user_usage_sessions")
      .update({ ended_at: row.last_seen_at })
      .eq("id", row.id);
    const resumed = await startOrResumeSession(userId, null);
    return recordHeartbeat(userId, resumed.sessionId);
  }

  const elapsedSec = Math.max(
    0,
    Math.floor((now.getTime() - lastSeen) / 1000),
  );
  const credit = Math.min(elapsedSec, MAX_HEARTBEAT_CREDIT_SECONDS);
  const nextActive = row.active_seconds + credit;

  const { error: updateError } = await supabase
    .from("user_usage_sessions")
    .update({
      last_seen_at: now.toISOString(),
      active_seconds: nextActive,
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(formatSupabaseNetworkError(updateError.message));
  }

  return { sessionId: row.id, activeSeconds: nextActive };
}

export async function endSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  requireSupabase();
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("user_usage_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  const row = data as SessionRow | null;
  if (!row || row.ended_at) {
    return;
  }

  const now = new Date();
  const lastSeen = new Date(row.last_seen_at).getTime();
  const elapsedSec = Math.max(
    0,
    Math.floor((now.getTime() - lastSeen) / 1000),
  );
  const credit = Math.min(elapsedSec, MAX_HEARTBEAT_CREDIT_SECONDS);

  const { error: updateError } = await supabase
    .from("user_usage_sessions")
    .update({
      last_seen_at: now.toISOString(),
      active_seconds: row.active_seconds + credit,
      ended_at: now.toISOString(),
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(formatSupabaseNetworkError(updateError.message));
  }
}

export async function recordPageVisit(
  userId: string,
  pathname: string,
): Promise<{ screenKey: string } | null> {
  requireSupabase();
  const screenKey = resolveScreenKey(pathname);
  if (!screenKey) {
    return null;
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from("user_page_visit_stats")
    .select("visit_count")
    .eq("user_id", userId)
    .eq("screen_key", screenKey)
    .maybeSingle();

  if (selectError) {
    throw new Error(formatSupabaseNetworkError(selectError.message));
  }

  if (existing) {
    const { error } = await supabase
      .from("user_page_visit_stats")
      .update({
        visit_count: (existing.visit_count as number) + 1,
        last_visited_at: now,
      })
      .eq("user_id", userId)
      .eq("screen_key", screenKey);

    if (error) {
      throw new Error(formatSupabaseNetworkError(error.message));
    }
  } else {
    const { error } = await supabase.from("user_page_visit_stats").insert({
      user_id: userId,
      screen_key: screenKey,
      visit_count: 1,
      last_visited_at: now,
    });

    if (error) {
      throw new Error(formatSupabaseNetworkError(error.message));
    }
  }

  return { screenKey };
}

export async function getUserUsageSummaries(): Promise<UserUsageSummary[]> {
  requireSupabase();
  const supabase = createServerClient();

  const [usersRes, sessionsRes, visitsRes] = await Promise.all([
    supabase
      .from("bid_users")
      .select("id, name, department, role, active, last_login_at")
      .order("id", { ascending: true }),
    supabase
      .from("user_usage_sessions")
      .select("user_id, active_seconds, last_seen_at"),
    supabase
      .from("user_page_visit_stats")
      .select("user_id, screen_key, visit_count, last_visited_at")
      .order("visit_count", { ascending: false }),
  ]);

  if (usersRes.error) {
    throw new Error(formatSupabaseNetworkError(usersRes.error.message));
  }
  if (sessionsRes.error) {
    throw new Error(formatSupabaseNetworkError(sessionsRes.error.message));
  }
  if (visitsRes.error) {
    throw new Error(formatSupabaseNetworkError(visitsRes.error.message));
  }

  const sessionAgg = new Map<
    string,
    { totalActiveSeconds: number; sessionCount: number; lastSeenAt: string | null }
  >();

  for (const row of (sessionsRes.data ?? []) as {
    user_id: string;
    active_seconds: number;
    last_seen_at: string;
  }[]) {
    const current = sessionAgg.get(row.user_id) ?? {
      totalActiveSeconds: 0,
      sessionCount: 0,
      lastSeenAt: null as string | null,
    };
    current.totalActiveSeconds += row.active_seconds ?? 0;
    current.sessionCount += 1;
    if (
      !current.lastSeenAt ||
      new Date(row.last_seen_at) > new Date(current.lastSeenAt)
    ) {
      current.lastSeenAt = row.last_seen_at;
    }
    sessionAgg.set(row.user_id, current);
  }

  const visitsByUser = new Map<string, PageVisitStat[]>();
  for (const row of (visitsRes.data ?? []) as VisitRow[]) {
    const list = visitsByUser.get(row.user_id) ?? [];
    list.push({
      screenKey: row.screen_key,
      screenLabel: screenLabel(row.screen_key),
      visitCount: row.visit_count,
      lastVisitedAt: row.last_visited_at,
    });
    visitsByUser.set(row.user_id, list);
  }

  return ((usersRes.data ?? []) as UserRow[]).map((user) => {
    const sessions = sessionAgg.get(user.id);
    return {
      userId: user.id,
      name: user.name,
      department: user.department ?? "",
      role: user.role,
      active: user.active,
      lastLoginAt: user.last_login_at,
      lastSeenAt: sessions?.lastSeenAt ?? null,
      totalActiveSeconds: sessions?.totalActiveSeconds ?? 0,
      sessionCount: sessions?.sessionCount ?? 0,
      pageVisits: visitsByUser.get(user.id) ?? [],
    };
  });
}
