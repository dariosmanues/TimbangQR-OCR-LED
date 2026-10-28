import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "./types";

const COOKIE_NAME = "timbang_session";

function secretKey() {
  const raw = (process.env.JWT_SECRET || "dev-only-change-this-jwt-secret-minimum-32").trim();
  return new TextEncoder().encode(raw);
}

export async function setSession(user: SessionUser) {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.COOKIE_SECURE || "").trim() === "true" || (process.env.APP_URL || "").trim().startsWith("https://") === true,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const result = await jwtVerify(token, secretKey());
    return (result.payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    redirect("/login");
    throw new Error("Redirecting to login");
  }
  return user;
}

export function isSuperAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || "").toUpperCase();
  return role === "SUPER_ADMIN" || role === "SUPERADMIN";
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || "").toUpperCase();
  return role === "ADMIN" || role === "ADMINISTRATOR";
}

export function canManageTransactions(user: SessionUser | null | undefined): boolean {
  // Hanya Super Admin yang memiliki hak akses CRUD
  return isSuperAdmin(user);
}

export function canManageArmada(user: SessionUser | null | undefined): boolean {
  // Hanya Super Admin yang memiliki hak akses CRUD
  return isSuperAdmin(user);
}

export function canManageSystem(user: SessionUser | null | undefined): boolean {
  // Hanya Super Admin yang memiliki hak akses CRUD
  return isSuperAdmin(user);
}

export function canCrud(user: SessionUser | null | undefined): boolean {
  // Hanya Super Admin yang memiliki hak akses CRUD
  return isSuperAdmin(user);
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) {
    throw new Error("Akses ditolak: Hanya Super Administrator yang memiliki izin untuk tindakan ini.");
  }
  return user;
}

export async function requireTransactionAdmin(): Promise<SessionUser> {
  return requireSuperAdmin();
}
