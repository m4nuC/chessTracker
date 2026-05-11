"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  activateReward as activateRewardDb,
  addDailyEntry,
  createReward,
  createSession,
  createTaskType,
  createWeeklyGoal,
  deleteReward as deleteRewardDb,
  deleteSession,
  deleteTaskType as deleteTaskTypeDb,
  getCurrentWeekStart,
  getSession,
  removeLastDailyEntry,
  resetDatabase as resetDatabaseDb,
  setTaskTypeActive,
  updateTaskTypePoints as updateTaskTypePointsDb,
  setWeeklyGoalActive,
  createBadge,
  deleteBadge as deleteBadgeDb,
  grantBadgeManually as grantBadgeManuallyDb,
  revokeBadgeManually as revokeBadgeManuallyDb,
  updateReward as updateRewardDb,
  validateRewardClaim,
  type Role
} from "@/lib/db";

const sessionCookieName = "abi_chess_session";
const oneYear = 60 * 60 * 24 * 365;

function getString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getPositiveInteger(formData: FormData, name: string, fallback = 1) {
  const value = Number(getString(formData, name));

  if (!Number.isInteger(value) || value < 1) {
    return fallback;
  }

  return value;
}

function getNonNegativeInteger(formData: FormData, name: string) {
  const value = Number(getString(formData, name));

  if (!Number.isInteger(value) || value < 0) {
    return 0;
  }

  return value;
}

function isRole(value: string): value is Role {
  return value === "child" || value === "admin";
}

async function requireAdmin() {
  const session = await getCurrentSession();

  if (session?.role !== "admin") {
    redirect("/");
  }
}

async function requireChild() {
  const session = await getCurrentSession();

  if (session?.role !== "child") {
    redirect("/");
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  return getSession(token);
}

export async function login(formData: FormData) {
  const role = getString(formData, "role");
  const password = getString(formData, "password");

  if (!isRole(role)) {
    redirect("/?login=failed");
  }

  const expectedPassword =
    role === "admin"
      ? process.env.ADMIN_PASSWORD ?? "admin"
      : process.env.CHILD_PASSWORD ?? "abi";

  if (password !== expectedPassword) {
    redirect("/?login=failed");
  }

  const session = createSession(role);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, session.token, {
    httpOnly: true,
    maxAge: oneYear,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  deleteSession(token);
  cookieStore.delete(sessionCookieName);

  redirect("/");
}

export async function addTaskType(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const unitLabel = getString(formData, "unitLabel");

  if (!name || !unitLabel) {
    return;
  }

  createTaskType({
    name,
    icon: getString(formData, "icon") || "pawn",
    pointsPerUnit: getPositiveInteger(formData, "pointsPerUnit"),
    unitLabel
  });

  revalidatePath("/");
}

export async function toggleTaskType(formData: FormData) {
  await requireAdmin();

  setTaskTypeActive(
    getPositiveInteger(formData, "id"),
    getString(formData, "active") === "true"
  );

  revalidatePath("/");
}

export async function updateTaskTypePoints(formData: FormData) {
  await requireAdmin();

  updateTaskTypePointsDb(
    getPositiveInteger(formData, "id"),
    getPositiveInteger(formData, "pointsPerUnit")
  );

  revalidatePath("/");
}

export async function deleteTaskType(formData: FormData) {
  await requireAdmin();

  deleteTaskTypeDb(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function addWeeklyGoal(formData: FormData) {
  await requireAdmin();

  createWeeklyGoal({
    taskTypeId: getPositiveInteger(formData, "taskTypeId"),
    targetQuantity: getPositiveInteger(formData, "targetQuantity"),
    bonusPoints: getNonNegativeInteger(formData, "bonusPoints"),
    weekStart: getString(formData, "weekStart") || getCurrentWeekStart()
  });

  revalidatePath("/");
}

export async function toggleWeeklyGoal(formData: FormData) {
  await requireAdmin();

  setWeeklyGoalActive(
    getPositiveInteger(formData, "id"),
    getString(formData, "active") === "true"
  );

  revalidatePath("/");
}

function parseIntervalPoints(formData: FormData) {
  if (getString(formData, "repeatable") !== "true") return null;
  const interval = getNonNegativeInteger(formData, "intervalPoints");
  return interval > 0 ? interval : null;
}

export async function addReward(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");

  if (!name) {
    return;
  }

  createReward({
    name,
    description: getString(formData, "description"),
    icon: getString(formData, "icon") || "trophy",
    requiredPoints: getNonNegativeInteger(formData, "requiredPoints"),
    intervalPoints: parseIntervalPoints(formData)
  });

  revalidatePath("/");
}

export async function updateReward(formData: FormData) {
  await requireAdmin();

  const id = getPositiveInteger(formData, "id");
  const name = getString(formData, "name");

  if (!id || !name) return;

  updateRewardDb({
    id,
    name,
    description: getString(formData, "description"),
    icon: getString(formData, "icon") || "trophy",
    requiredPoints: getNonNegativeInteger(formData, "requiredPoints"),
    intervalPoints: parseIntervalPoints(formData)
  });

  revalidatePath("/");
}

export async function activateReward(formData: FormData) {
  await requireChild();

  activateRewardDb(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function markRewardClaimed(formData: FormData) {
  await requireAdmin();

  validateRewardClaim(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function deleteReward(formData: FormData) {
  await requireAdmin();

  deleteRewardDb(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function recordWork(formData: FormData) {
  await requireChild();

  addDailyEntry(getPositiveInteger(formData, "taskTypeId"));

  revalidatePath("/");
}

export async function undoWork(formData: FormData) {
  await requireChild();

  removeLastDailyEntry(getPositiveInteger(formData, "taskTypeId"));

  revalidatePath("/");
}

export async function addBadge(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const conditionType = getString(formData, "conditionType");

  if (!name || !conditionType) {
    return;
  }

  createBadge({
    name,
    description: getString(formData, "description"),
    icon: getString(formData, "icon") || "🏆",
    xp: getNonNegativeInteger(formData, "xp"),
    conditionType,
    conditionValue: getPositiveInteger(formData, "conditionValue")
  });

  revalidatePath("/");
}

export async function deleteBadge(formData: FormData) {
  await requireAdmin();

  deleteBadgeDb(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function grantBadge(formData: FormData) {
  await requireAdmin();

  grantBadgeManuallyDb(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function revokeBadge(formData: FormData) {
  await requireAdmin();

  revokeBadgeManuallyDb(getPositiveInteger(formData, "id"));

  revalidatePath("/");
}

export async function resetDatabase(formData: FormData) {
  await requireAdmin();

  if (getString(formData, "confirm") !== "RESET") {
    redirect("/?reset=invalid");
  }

  resetDatabaseDb();

  revalidatePath("/");
  redirect("/?reset=ok");
}
