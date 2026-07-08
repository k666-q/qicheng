/**
 * 本地模拟认证层。
 * 接口签名与 Supabase Auth 对齐，后续可整体替换实现。
 */

const USER_KEY = "qc_auth_user";
const USERS_DB_KEY = "qc_users_db";

export type UserRole = "user" | "admin";

export type LocalUser = {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  createdAt: string;
};

function getUsersDB(): Record<string, { password: string; user: LocalUser }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(USERS_DB_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUsersDB(db: Record<string, { password: string; user: LocalUser }>) {
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
}

export function getUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  return getUser()?.role === "admin";
}

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("qc_anonymous_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("qc_anonymous_id", id);
  }
  return id;
}

type AuthResult = { success: true; user: LocalUser } | { success: false; error: string };

export function signUp(email: string, password: string, nickname: string): AuthResult {
  if (!email.trim() || !password) {
    return { success: false, error: "邮箱和密码不能为空" };
  }
  if (password.length < 6) {
    return { success: false, error: "密码至少 6 位" };
  }

  const db = getUsersDB();
  if (db[email]) {
    return { success: false, error: "该邮箱已注册" };
  }

  // 管理员检测：环境变量在客户端不可用，用硬编码兜底
  const isAdminEmail = email === "admin@nexiova.local";

  const user: LocalUser = {
    id: crypto.randomUUID(),
    email,
    nickname: nickname || email.split("@")[0],
    role: isAdminEmail ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };

  db[email] = { password, user };
  saveUsersDB(db);

  // 新用户注册时清理旧残留数据
  clearAllUserData();

  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem("qc_anonymous_id", user.id);

  return { success: true, user };
}

export function signIn(email: string, password: string): AuthResult {
  if (!email.trim() || !password) {
    return { success: false, error: "邮箱和密码不能为空" };
  }

  const db = getUsersDB();
  const record = db[email];
  if (!record) {
    return { success: false, error: "账号不存在" };
  }
  if (record.password !== password) {
    return { success: false, error: "密码错误" };
  }

  // 如果切换了账号，清理旧数据
  const currentUser = getUser();
  if (currentUser && currentUser.id !== record.user.id) {
    clearAllUserData();
  }

  localStorage.setItem(USER_KEY, JSON.stringify(record.user));
  localStorage.setItem("qc_anonymous_id", record.user.id);

  return { success: true, user: record.user };
}

export function signOut() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
}

export function signOutAndClear() {
  clearAllUserData();
  signOut();
}

/**
 * 清除所有用户学习数据（保留账号数据库和偏好设置）。
 * 解决残留数据跨用户污染问题。
 */
export function clearAllUserData() {
  if (typeof window === "undefined") return;

  const PREFIXES = ["qicheng_", "qc_plan", "qc_note", "qc_img", "qc_audio", "qc_audios", "spec_progress_", "spec_cache_"];
  const EXACT_KEYS = [
    "qicheng_plan", "qicheng_draft_backup", "qicheng_plan_start",
    "qicheng_emotion_curve", "qicheng_tasks_completed", "qicheng_milestones",
    "qicheng_profile_events", "qicheng_corrections", "qicheng_badges",
    "qicheng_universe_overview_mode", "qicheng_universe_tutorial_done",
    "qc_plan_start_date",
  ];

  // sessionStorage 全清
  try { sessionStorage.clear(); } catch {}

  // localStorage 按前缀清
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (EXACT_KEYS.includes(key) || PREFIXES.some((p) => key.startsWith(p))) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
