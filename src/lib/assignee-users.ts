import { listDepartments } from "@/lib/departments";
import { getAllUsers } from "@/lib/users-store";

export interface AssigneeUserOption {
  id: string;
  name: string;
  department: string;
}

export async function listAssigneeUsers(options?: {
  departmentName?: string;
}): Promise<{ users: AssigneeUserOption[]; error: string | null }> {
  const { departments, error: departmentsError } = await listDepartments({
    activeOnly: true,
  });
  if (departmentsError) {
    return { users: [], error: departmentsError };
  }

  const activeDepartmentNames = new Set(
    departments.map((row) => row.name.toLowerCase()),
  );

  const allUsers = await getAllUsers();
  let users = allUsers
    .filter((user) => user.active)
    .filter((user) => {
      const dept = user.department.trim();
      return dept && activeDepartmentNames.has(dept.toLowerCase());
    })
    .map((user) => ({
      id: user.id,
      name: user.name,
      department: user.department.trim(),
    }));

  const departmentName = options?.departmentName?.trim();
  if (departmentName) {
    const normalized = departmentName.toLowerCase();
    users = users.filter(
      (user) => user.department.toLowerCase() === normalized,
    );
  }

  users.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return { users, error: null };
}

export async function listAssigneeUsersByDepartment(): Promise<{
  usersByDepartment: Record<string, AssigneeUserOption[]>;
  error: string | null;
}> {
  const { users, error } = await listAssigneeUsers();
  if (error) {
    return { usersByDepartment: {}, error };
  }

  const usersByDepartment: Record<string, AssigneeUserOption[]> = {};
  for (const user of users) {
    if (!usersByDepartment[user.department]) {
      usersByDepartment[user.department] = [];
    }
    usersByDepartment[user.department].push(user);
  }

  return { usersByDepartment, error: null };
}
