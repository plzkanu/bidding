import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import type { User, UserRole } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const DEFAULT_ADMIN_ID = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin123";

interface UsersFile {
  users: User[];
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readUsersFile(): Promise<UsersFile> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const normalized = raw.replace(/^\uFEFF/, "");
    return JSON.parse(normalized) as UsersFile;
  } catch {
    return { users: [] };
  }
}

async function writeUsersFile(data: UsersFile) {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function seedDefaultAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  const admin: User = {
    id: DEFAULT_ADMIN_ID,
    passwordHash,
    name: "시스템 관리자",
    department: "",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  };
  await writeUsersFile({ users: [admin] });
  return admin;
}

export async function getAllUsers(): Promise<User[]> {
  const file = await readUsersFile();
  if (file.users.length === 0) {
    const admin = await seedDefaultAdmin();
    return [admin];
  }
  return file.users.map((user) => ({
    ...user,
    department: user.department ?? "",
  }));
}

export async function findUserById(id: string): Promise<User | null> {
  const users = await getAllUsers();
  return users.find((user) => user.id === id) ?? null;
}

export async function verifyUserCredentials(
  id: string,
  password: string,
): Promise<User | null> {
  const user = await findUserById(id);
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
  const users = await getAllUsers();
  const normalizedId = input.id.trim().toLowerCase();

  if (!normalizedId) {
    throw new Error("아이디를 입력해 주세요.");
  }
  if (users.some((user) => user.id === normalizedId)) {
    throw new Error("이미 사용 중인 아이디입니다.");
  }
  if (input.password.length < 6) {
    throw new Error("비밀번호는 6자 이상이어야 합니다.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const newUser: User = {
    id: normalizedId,
    passwordHash,
    name: input.name.trim() || normalizedId,
    department: input.department?.trim() ?? "",
    role: input.role,
    active: input.active ?? true,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsersFile({ users });
  return newUser;
}

export interface UpdateUserInput {
  name?: string;
  department?: string;
  role?: UserRole;
  active?: boolean;
  password?: string;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<User> {
  const users = await getAllUsers();
  const index = users.findIndex((user) => user.id === id);

  if (index === -1) {
    throw new Error("계정을 찾을 수 없습니다.");
  }

  const user = users[index];

  if (input.name !== undefined) {
    user.name = input.name.trim() || user.id;
  }
  if (input.department !== undefined) {
    user.department = input.department.trim();
  }
  if (input.role !== undefined) {
    user.role = input.role;
  }
  if (input.active !== undefined) {
    user.active = input.active;
  }
  if (input.password) {
    if (input.password.length < 6) {
      throw new Error("비밀번호는 6자 이상이어야 합니다.");
    }
    user.passwordHash = await bcrypt.hash(input.password, 10);
  }

  users[index] = user;
  await writeUsersFile({ users });
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const users = await getAllUsers();

  if (id === DEFAULT_ADMIN_ID) {
    throw new Error("기본 관리자 계정은 삭제할 수 없습니다.");
  }

  const adminCount = users.filter(
    (user) => user.role === "admin" && user.active,
  ).length;
  const target = users.find((user) => user.id === id);

  if (!target) {
    throw new Error("계정을 찾을 수 없습니다.");
  }
  if (target.role === "admin" && adminCount <= 1) {
    throw new Error("활성 관리자가 한 명뿐이라 삭제할 수 없습니다.");
  }

  const next = users.filter((user) => user.id !== id);
  await writeUsersFile({ users: next });
}

export function getDefaultAdminCredentials() {
  return {
    id: DEFAULT_ADMIN_ID,
    password: DEFAULT_ADMIN_PASSWORD,
  };
}
