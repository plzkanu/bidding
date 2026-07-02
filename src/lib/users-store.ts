import bcrypt from "bcryptjs";
import { createServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatSupabaseNetworkError } from "@/lib/supabase/fetch";
import type { User, UserRole } from "./types";

const DEFAULT_ADMIN_ID = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

interface BidUserRow {
  id: string;
  name: string;
  password_hash: string;
  role: UserRole;
  department: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapUser(row: BidUserRow): User {
  return {
    id: row.id,
    passwordHash: row.password_hash,
    name: row.name,
    department: row.department ?? "",
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
  };
}

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase가 설정되지 않았습니다. 사용자 데이터는 Supabase bid_users 테이블에 저장됩니다.",
    );
  }
}

async function seedDefaultAdminIfEmpty(): Promise<void> {
  const supabase = createServerClient();
  const { count, error: countError } = await supabase
    .from("bid_users")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(formatSupabaseNetworkError(countError.message));
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const { error } = await supabase.from("bid_users").insert({
    id: DEFAULT_ADMIN_ID,
    name: "시스템 관리자",
    password_hash: passwordHash,
    role: "admin",
    department: "",
    active: true,
  });

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }
}

export async function getAllUsers(): Promise<User[]> {
  requireSupabase();
  await seedDefaultAdminIfEmpty();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bid_users")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  return (data ?? []).map((row) => mapUser(row as BidUserRow));
}

export async function findUserById(id: string): Promise<User | null> {
  requireSupabase();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bid_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  return data ? mapUser(data as BidUserRow) : null;
}

export async function verifyUserCredentials(
  id: string,
  password: string,
): Promise<User | null> {
  requireSupabase();
  await seedDefaultAdminIfEmpty();

  const user = await findUserById(id.trim().toLowerCase());
  if (!user || !user.active) {
    return null;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export interface CreateUserInput {
  id: string;
  password: string;
  name: string;
  department?: string;
  role: UserRole;
  active?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  requireSupabase();

  const normalizedId = input.id.trim().toLowerCase();

  if (!normalizedId) {
    throw new Error("아이디를 입력해 주세요.");
  }

  const existing = await findUserById(normalizedId);
  if (existing) {
    throw new Error("이미 사용 중인 아이디입니다.");
  }

  if (input.password.length < 6) {
    throw new Error("비밀번호는 6자 이상이어야 합니다.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bid_users")
    .insert({
      id: normalizedId,
      name: input.name.trim() || normalizedId,
      password_hash: passwordHash,
      role: input.role,
      department: input.department?.trim() ?? "",
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("이미 사용 중인 아이디입니다.");
    }
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  return mapUser(data as BidUserRow);
}

export interface UpdateUserInput {
  name?: string;
  department?: string;
  role?: UserRole;
  active?: boolean;
  password?: string;
}

async function countActiveAdmins(excludeId?: string): Promise<number> {
  const users = await getAllUsers();
  return users.filter(
    (user) =>
      user.role === "admin" &&
      user.active &&
      (excludeId === undefined || user.id !== excludeId),
  ).length;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<User> {
  requireSupabase();

  const existing = await findUserById(id);
  if (!existing) {
    throw new Error("계정을 찾을 수 없습니다.");
  }

  const nextRole = input.role ?? existing.role;
  const nextActive = input.active ?? existing.active;

  if (
    existing.role === "admin" &&
    existing.active &&
    (nextRole !== "admin" || !nextActive)
  ) {
    const remaining = await countActiveAdmins(id);
    if (remaining < 1) {
      throw new Error("활성 관리자가 한 명뿐이라 변경할 수 없습니다.");
    }
  }

  const patch: Record<string, string | boolean> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    patch.name = input.name.trim() || existing.id;
  }
  if (input.department !== undefined) {
    patch.department = input.department.trim();
  }
  if (input.role !== undefined) {
    patch.role = input.role;
  }
  if (input.active !== undefined) {
    patch.active = input.active;
  }
  if (input.password) {
    if (input.password.length < 6) {
      throw new Error("비밀번호는 6자 이상이어야 합니다.");
    }
    patch.password_hash = await bcrypt.hash(input.password, 10);
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bid_users")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }

  return mapUser(data as BidUserRow);
}

export async function deleteUser(id: string): Promise<void> {
  requireSupabase();

  if (id === DEFAULT_ADMIN_ID) {
    throw new Error("기본 관리자 계정은 삭제할 수 없습니다.");
  }

  const target = await findUserById(id);
  if (!target) {
    throw new Error("계정을 찾을 수 없습니다.");
  }

  if (target.role === "admin" && target.active) {
    const adminCount = await countActiveAdmins(id);
    if (adminCount < 1) {
      throw new Error("활성 관리자가 한 명뿐이라 삭제할 수 없습니다.");
    }
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("bid_users").delete().eq("id", id);

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }
}

export function getDefaultAdminCredentials() {
  return {
    id: DEFAULT_ADMIN_ID,
    password: DEFAULT_ADMIN_PASSWORD,
  };
}
