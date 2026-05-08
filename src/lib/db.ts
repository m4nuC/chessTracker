import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export type Role = "child" | "admin";

export type Session = {
  token: string;
  role: Role;
  expiresAt: string;
};

export type TaskType = {
  id: number;
  name: string;
  icon: string;
  pointsPerUnit: number;
  unitLabel: string;
  active: boolean;
};

export type WeeklyGoal = {
  id: number;
  taskTypeId: number;
  taskName: string;
  taskIcon: string;
  unitLabel: string;
  targetQuantity: number;
  bonusPoints: number;
  weekStart: string;
  active: boolean;
  progressQuantity: number;
  bonusAwarded: boolean;
};

export type TodayTask = {
  taskTypeId: number;
  name: string;
  icon: string;
  pointsPerUnit: number;
  unitLabel: string;
  quantity: number;
  pointsEarned: number;
};

export type Reward = {
  id: number;
  name: string;
  description: string;
  icon: string;
  requiredPoints: number;
  status: "locked" | "unlocked" | "claimed";
};

export type Badge = {
  name: string;
  description: string;
  earned: boolean;
};

export type AppState = {
  today: string;
  currentWeekStart: string;
  totalPoints: number;
  workPoints: number;
  bonusPoints: number;
  level: number;
  nextLevelAt: number;
  streak: number;
  todayTasks: TodayTask[];
  taskTypes: TaskType[];
  weeklyGoals: WeeklyGoal[];
  rewards: Reward[];
  badges: Badge[];
};

const globalForDb = globalThis as unknown as {
  chessTrackerDb?: Database.Database;
};

function createDb() {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('child', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'pawn',
      points_per_unit INTEGER NOT NULL CHECK (points_per_unit > 0),
      unit_label TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type_id INTEGER NOT NULL REFERENCES task_types(id),
      target_quantity INTEGER NOT NULL CHECK (target_quantity > 0),
      bonus_points INTEGER NOT NULL CHECK (bonus_points >= 0),
      week_start TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_type_id INTEGER NOT NULL REFERENCES task_types(id),
      entry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goal_bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weekly_goal_id INTEGER NOT NULL UNIQUE REFERENCES weekly_goals(id),
      awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'trophy',
      required_points INTEGER NOT NULL CHECK (required_points >= 0),
      status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'claimed')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS daily_entries_date_idx
      ON daily_entries(entry_date);

    CREATE INDEX IF NOT EXISTS daily_entries_task_date_idx
      ON daily_entries(task_type_id, entry_date);
  `);

  return db;
}

function getDb() {
  if (!globalForDb.chessTrackerDb) {
    globalForDb.chessTrackerDb = createDb();
  }

  return globalForDb.chessTrackerDb;
}

function nowIso() {
  return new Date().toISOString();
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function addDays(date: string, days: number) {
  const parsed = parseLocalDate(date);
  parsed.setDate(parsed.getDate() + days);

  return formatLocalDate(parsed);
}

export function getCurrentWeekStart(date = new Date()) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  return formatLocalDate(weekStart);
}

export function createSession(role: Role) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  getDb()
    .prepare(
      `INSERT INTO sessions (token, role, expires_at)
       VALUES (?, ?, ?)`
    )
    .run(token, role, expiresAt.toISOString());

  return { token, role, expiresAt: expiresAt.toISOString() };
}

export function getSession(token?: string) {
  if (!token) {
    return null;
  }

  const session = getDb()
    .prepare(
      `SELECT token, role, expires_at as expiresAt
       FROM sessions
       WHERE token = ? AND expires_at > ?`
    )
    .get(token, nowIso()) as Session | undefined;

  return session ?? null;
}

export function deleteSession(token?: string) {
  if (!token) {
    return;
  }

  getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function createTaskType(input: {
  name: string;
  icon: string;
  pointsPerUnit: number;
  unitLabel: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO task_types (name, icon, points_per_unit, unit_label)
       VALUES (?, ?, ?, ?)`
    )
    .run(input.name, input.icon, input.pointsPerUnit, input.unitLabel);
}

export function setTaskTypeActive(id: number, active: boolean) {
  getDb()
    .prepare("UPDATE task_types SET active = ? WHERE id = ?")
    .run(active ? 1 : 0, id);
}

export function deleteTaskType(id: number) {
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `DELETE FROM goal_bonuses
       WHERE weekly_goal_id IN (
         SELECT id
         FROM weekly_goals
         WHERE task_type_id = ?
       )`
    ).run(id);
    db.prepare("DELETE FROM weekly_goals WHERE task_type_id = ?").run(id);
    db.prepare("DELETE FROM daily_entries WHERE task_type_id = ?").run(id);
    db.prepare("DELETE FROM task_types WHERE id = ?").run(id);
  })();
}

export function createWeeklyGoal(input: {
  taskTypeId: number;
  targetQuantity: number;
  bonusPoints: number;
  weekStart: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO weekly_goals (
        task_type_id,
        target_quantity,
        bonus_points,
        week_start
      )
      VALUES (?, ?, ?, ?)`
    )
    .run(
      input.taskTypeId,
      input.targetQuantity,
      input.bonusPoints,
      input.weekStart
    );
}

export function setWeeklyGoalActive(id: number, active: boolean) {
  getDb()
    .prepare("UPDATE weekly_goals SET active = ? WHERE id = ?")
    .run(active ? 1 : 0, id);
}

export function createReward(input: {
  name: string;
  description: string;
  icon: string;
  requiredPoints: number;
}) {
  getDb()
    .prepare(
      `INSERT INTO rewards (name, description, icon, required_points)
       VALUES (?, ?, ?, ?)`
    )
    .run(input.name, input.description, input.icon, input.requiredPoints);
  unlockEligibleRewards();
}

export function claimReward(id: number) {
  getDb()
    .prepare("UPDATE rewards SET status = 'claimed' WHERE id = ? AND status = 'unlocked'")
    .run(id);
}

export function deleteReward(id: number) {
  getDb().prepare("DELETE FROM rewards WHERE id = ?").run(id);
}

export function addDailyEntry(taskTypeId: number, quantity = 1) {
  const db = getDb();

  db.transaction(() => {
    const task = db
      .prepare("SELECT id FROM task_types WHERE id = ? AND active = 1")
      .get(taskTypeId);

    if (!task) {
      return;
    }

    db.prepare(
      `INSERT INTO daily_entries (task_type_id, entry_date, quantity)
       VALUES (?, ?, ?)`
    ).run(taskTypeId, formatLocalDate(), quantity);

    awardReachedWeeklyBonuses();
    unlockEligibleRewards();
  })();
}

function getWorkPoints() {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(de.quantity * tt.points_per_unit), 0) as points
       FROM daily_entries de
       JOIN task_types tt ON tt.id = de.task_type_id`
    )
    .get() as { points: number };

  return row.points;
}

function getBonusPoints() {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(wg.bonus_points), 0) as points
       FROM goal_bonuses gb
       JOIN weekly_goals wg ON wg.id = gb.weekly_goal_id`
    )
    .get() as { points: number };

  return row.points;
}

function getTotalPoints() {
  return getWorkPoints() + getBonusPoints();
}

function awardReachedWeeklyBonuses() {
  const db = getDb();
  const today = formatLocalDate();
  const goals = db
    .prepare(
      `SELECT
        wg.id,
        wg.task_type_id as taskTypeId,
        wg.target_quantity as targetQuantity,
        wg.week_start as weekStart
       FROM weekly_goals wg
       LEFT JOIN goal_bonuses gb ON gb.weekly_goal_id = wg.id
       WHERE wg.active = 1
        AND gb.id IS NULL
        AND ? BETWEEN wg.week_start AND date(wg.week_start, '+6 days')`
    )
    .all(today) as {
    id: number;
    taskTypeId: number;
    targetQuantity: number;
    weekStart: string;
  }[];

  for (const goal of goals) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(quantity), 0) as quantity
         FROM daily_entries
         WHERE task_type_id = ?
          AND entry_date BETWEEN ? AND ?`
      )
      .get(goal.taskTypeId, goal.weekStart, addDays(goal.weekStart, 6)) as {
      quantity: number;
    };

    if (row.quantity >= goal.targetQuantity) {
      db.prepare("INSERT OR IGNORE INTO goal_bonuses (weekly_goal_id) VALUES (?)")
        .run(goal.id);
    }
  }
}

function unlockEligibleRewards() {
  const totalPoints = getTotalPoints();

  getDb()
    .prepare(
      `UPDATE rewards
       SET status = 'unlocked'
       WHERE status = 'locked' AND required_points <= ?`
    )
    .run(totalPoints);
}

function getTaskTypes() {
  return getDb()
    .prepare(
      `SELECT
        tt.id,
        tt.name,
        tt.icon,
        tt.points_per_unit as pointsPerUnit,
        tt.unit_label as unitLabel,
        tt.active
       FROM task_types tt
       ORDER BY tt.active DESC, tt.name ASC`
    )
    .all()
    .map((task) => ({
      ...(task as Omit<TaskType, "active"> & {
        active: number;
      }),
      active: Boolean((task as { active: number }).active)
    }));
}

function getTodayTasks(today: string) {
  return getDb()
    .prepare(
      `SELECT
        tt.id as taskTypeId,
        tt.name,
        tt.icon,
        tt.points_per_unit as pointsPerUnit,
        tt.unit_label as unitLabel,
        COALESCE(SUM(de.quantity), 0) as quantity,
        COALESCE(SUM(de.quantity), 0) * tt.points_per_unit as pointsEarned
       FROM task_types tt
       LEFT JOIN daily_entries de
        ON de.task_type_id = tt.id
        AND de.entry_date = ?
       WHERE tt.active = 1
       GROUP BY tt.id
       ORDER BY tt.name ASC`
    )
    .all(today) as TodayTask[];
}

function getWeeklyGoals(weekStart: string) {
  return getDb()
    .prepare(
      `SELECT
        wg.id,
        wg.task_type_id as taskTypeId,
        tt.name as taskName,
        tt.icon as taskIcon,
        tt.unit_label as unitLabel,
        wg.target_quantity as targetQuantity,
        wg.bonus_points as bonusPoints,
        wg.week_start as weekStart,
        wg.active,
        COALESCE(SUM(de.quantity), 0) as progressQuantity,
        gb.id IS NOT NULL as bonusAwarded
       FROM weekly_goals wg
       JOIN task_types tt ON tt.id = wg.task_type_id
       LEFT JOIN daily_entries de
        ON de.task_type_id = wg.task_type_id
        AND de.entry_date BETWEEN wg.week_start AND date(wg.week_start, '+6 days')
       LEFT JOIN goal_bonuses gb ON gb.weekly_goal_id = wg.id
       WHERE wg.week_start = ?
       GROUP BY wg.id
       ORDER BY wg.active DESC, tt.name ASC`
    )
    .all(weekStart)
    .map((goal) => ({
      ...(goal as Omit<WeeklyGoal, "active" | "bonusAwarded"> & {
        active: number;
        bonusAwarded: number;
      }),
      active: Boolean((goal as { active: number }).active),
      bonusAwarded: Boolean((goal as { bonusAwarded: number }).bonusAwarded)
    }));
}

function getRewards() {
  return getDb()
    .prepare(
      `SELECT
        id,
        name,
        description,
        icon,
        required_points as requiredPoints,
        status
       FROM rewards
       ORDER BY required_points ASC, id ASC`
    )
    .all() as Reward[];
}

function getStreak(today: string) {
  const dates = getDb()
    .prepare(
      `SELECT entry_date as entryDate
       FROM daily_entries
       GROUP BY entry_date
       ORDER BY entry_date DESC`
    )
    .all() as { entryDate: string }[];

  let expectedDate = today;
  let streak = 0;

  for (const row of dates) {
    if (row.entryDate === expectedDate) {
      streak += 1;
      expectedDate = addDays(expectedDate, -1);
    } else if (row.entryDate < expectedDate) {
      break;
    }
  }

  return streak;
}

function getBadges(streak: number) {
  const row = getDb()
    .prepare(
      `SELECT
        COALESCE(SUM(de.quantity), 0) as totalUnits,
        COALESCE(SUM(CASE WHEN LOWER(tt.name) LIKE '%puzzle%' THEN de.quantity ELSE 0 END), 0) as puzzleUnits,
        COALESCE(SUM(CASE WHEN LOWER(tt.name) LIKE '%bot%' THEN de.quantity ELSE 0 END), 0) as botUnits
       FROM daily_entries de
       JOIN task_types tt ON tt.id = de.task_type_id`
    )
    .get() as { totalUnits: number; puzzleUnits: number; botUnits: number };
  const bonusRow = getDb()
    .prepare("SELECT COUNT(*) as count FROM goal_bonuses")
    .get() as { count: number };

  return [
    {
      name: "Premier coup",
      description: "Terminer ta première activité d'échecs.",
      earned: row.totalUnits > 0
    },
    {
      name: "Objectif atteint",
      description: "Atteindre un objectif hebdomadaire.",
      earned: bonusRow.count > 0
    },
    {
      name: "Série de 7 jours",
      description: "Noter du travail d'échecs sept jours de suite.",
      earned: streak >= 7
    },
    {
      name: "Force des puzzles",
      description: "Résoudre 100 puzzles.",
      earned: row.puzzleUnits >= 100
    },
    {
      name: "Combattante des bots",
      description: "Jouer 10 parties contre les bots.",
      earned: row.botUnits >= 10
    }
  ] satisfies Badge[];
}

export function getAppState(): AppState {
  awardReachedWeeklyBonuses();
  unlockEligibleRewards();

  const today = formatLocalDate();
  const currentWeekStart = getCurrentWeekStart();
  const workPoints = getWorkPoints();
  const bonusPoints = getBonusPoints();
  const totalPoints = workPoints + bonusPoints;
  const level = Math.floor(totalPoints / 100) + 1;
  const streak = getStreak(today);

  return {
    today,
    currentWeekStart,
    totalPoints,
    workPoints,
    bonusPoints,
    level,
    nextLevelAt: level * 100,
    streak,
    todayTasks: getTodayTasks(today),
    taskTypes: getTaskTypes(),
    weeklyGoals: getWeeklyGoals(currentWeekStart),
    rewards: getRewards(),
    badges: getBadges(streak)
  };
}
