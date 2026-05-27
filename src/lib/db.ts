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
  intervalPoints: number | null;
  timesUnlocked: number;
  timesActivated: number;
  timesClaimed: number;
  timesAvailable: number;
  timesPending: number;
  nextUnlockAt: number | null;
};

export type Badge = {
  id: number;
  name: string;
  description: string;
  earned: boolean;
  manuallyEarned: boolean;
  icon: string;
  xp: number;
  conditionType: string;
  conditionValue: number;
};

export type DailyStatus = {
  date: string;
  active: boolean;
  isToday: boolean;
};

export type AppState = {
  today: string;
  currentWeekStart: string;
  totalPoints: number;
  workPoints: number;
  bonusPoints: number;
  badgePoints: number;
  level: number;
  nextLevelAt: number;
  streak: number;
  recentActivity: DailyStatus[];
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
      interval_points INTEGER,
      times_activated INTEGER NOT NULL DEFAULT 0,
      times_claimed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '🏆',
      xp INTEGER NOT NULL CHECK (xp >= 0),
      condition_type TEXT NOT NULL,
      condition_value INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS manual_badge_unlocks (
      badge_id INTEGER PRIMARY KEY REFERENCES badges(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS daily_entries_date_idx
      ON daily_entries(entry_date);

    CREATE INDEX IF NOT EXISTS daily_entries_task_date_idx
      ON daily_entries(task_type_id, entry_date);
  `);

  migrateRewardsTable(db);
  seedDefaults(db);

  return db;
}

function migrateRewardsTable(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(rewards)").all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("interval_points")) {
    db.exec("ALTER TABLE rewards ADD COLUMN interval_points INTEGER");
  }
  if (!colNames.has("times_activated")) {
    db.exec("ALTER TABLE rewards ADD COLUMN times_activated INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.has("times_claimed")) {
    db.exec("ALTER TABLE rewards ADD COLUMN times_claimed INTEGER NOT NULL DEFAULT 0");
    db.exec(
      "UPDATE rewards SET times_activated = 1, times_claimed = 1 WHERE status = 'claimed'"
    );
  }
}

function seedDefaults(db: Database.Database) {
  const badgesCount = db.prepare("SELECT COUNT(*) as count FROM badges").get() as { count: number };
  if (badgesCount.count === 0) {
    const stmt = db.prepare(
      `INSERT INTO badges (name, description, icon, xp, condition_type, condition_value) VALUES (?, ?, ?, ?, ?, ?)`
    );
    db.transaction(() => {
      stmt.run("Premier coup", "Terminer 10 activités d'échecs.", "🎯", 20, "total_units", 10);
      stmt.run("Premiers puzzles", "Résoudre 25 puzzles.", "🧩", 25, "puzzle_units", 25);
      stmt.run("Premier match", "Jouer ta première partie contre un bot.", "⚔️", 25, "bot_units", 1);
      stmt.run("Trois jours d'affilée", "Trois jours d'échecs de suite.", "🔁", 40, "streak", 3);
      stmt.run("Objectif décroché", "Atteindre un objectif hebdomadaire.", "🏆", 50, "weekly_goals", 1);
      stmt.run("Une semaine sérieuse", "Sept jours d'échecs de suite.", "📅", 75, "streak", 7);
      stmt.run("100 puzzles", "Résoudre 100 puzzles au total.", "🧩", 60, "puzzle_units", 100);
      stmt.run("10 bots vaincus", "Jouer 10 parties contre les bots.", "🤖", 80, "bot_units", 10);
      stmt.run("300 puzzles", "Résoudre 300 puzzles au total.", "💪", 100, "puzzle_units", 300);
      stmt.run("Triple champ", "Atteindre 3 objectifs hebdomadaires au total.", "🏅", 100, "weekly_goals", 3);
      stmt.run("Mois complet", "Trente jours d'échecs de suite.", "📆", 200, "streak", 30);
      stmt.run("600 puzzles", "Résoudre 600 puzzles au total.", "🧠", 150, "puzzle_units", 600);
      stmt.run("25 bots vaincus", "Jouer 25 parties contre les bots.", "🤖", 150, "bot_units", 25);
      stmt.run("1000 puzzles", "Résoudre 1000 puzzles au total.", "👑", 250, "puzzle_units", 1000);
      stmt.run("Cap des 1000 unités", "Mille activités d'échecs au total.", "🌟", 300, "total_units", 1000);
      stmt.run("Combo de 14 jours", "Quatorze jours d'échecs de suite.", "🔥", 100, "streak", 14);
      stmt.run("Marathon", "Soixante jours d'échecs de suite.", "🏃", 250, "streak", 60);
      stmt.run("50 bots vaincus", "Jouer 50 parties contre les bots.", "🤖", 200, "bot_units", 50);
      stmt.run("5 objectifs hebdo", "Atteindre 5 objectifs hebdomadaires au total.", "⭐", 150, "weekly_goals", 5);
      stmt.run("500 activités", "Cinq cents activités d'échecs au total.", "🚀", 200, "total_units", 500);
    })();
  }

  const tasksCount = db.prepare("SELECT COUNT(*) as count FROM task_types").get() as { count: number };
  if (tasksCount.count === 0) {
    const stmt = db.prepare(
      `INSERT INTO task_types (name, icon, points_per_unit, unit_label) VALUES (?, ?, ?, ?)`
    );
    db.transaction(() => {
      stmt.run("Puzzles", "🧩", 1.5, "puzzle");
      stmt.run("Parties bot", "🤖", 8, "partie");
      stmt.run("Parties elo", "⚔️", 11, "partie");
    })();
  }

  const goalsCount = db.prepare("SELECT COUNT(*) as count FROM weekly_goals").get() as { count: number };
  if (goalsCount.count === 0) {
    const weekStart = computeCurrentWeekStartIso();
    const tasks = db
      .prepare("SELECT id, name FROM task_types")
      .all() as { id: number; name: string }[];
    const stmt = db.prepare(
      `INSERT INTO weekly_goals (task_type_id, target_quantity, bonus_points, week_start) VALUES (?, ?, ?, ?)`
    );
    db.transaction(() => {
      for (const task of tasks) {
        const lower = task.name.toLowerCase();
        if (lower.includes("puzzle")) stmt.run(task.id, 40, 25, weekStart);
        else if (lower.includes("bot")) stmt.run(task.id, 3, 25, weekStart);
        else if (lower.includes("elo")) stmt.run(task.id, 3, 30, weekStart);
      }
    })();
  }

  const rewardsCount = db.prepare("SELECT COUNT(*) as count FROM rewards").get() as { count: number };
  if (rewardsCount.count === 0) {
    const stmt = db.prepare(
      `INSERT INTO rewards (name, description, icon, required_points, interval_points) VALUES (?, ?, ?, ?, ?)`
    );
    db.transaction(() => {
      stmt.run("Choix du dessert", "Choisis le dessert ce soir.", "🍨", 100, null);
      stmt.run("Choix du film du soir", "Tu choisis le film qu'on regarde.", "🎬", 450, 1500);
      stmt.run("Sortie glace", "Une sortie pour aller manger une glace.", "🍦", 700, 2500);
      stmt.run("Tu choisis le repas du soir", "Tu décides du menu de ce soir.", "🍽️", 1400, 3500);
      stmt.run("Petit jouet surprise", "Un petit jouet à choisir ensemble.", "🎁", 1900, null);
      stmt.run("Skin Epic Overwatch", "Un skin Epic Overwatch au choix.", "🎨", 2500, 3000);
      stmt.run("1 roman de ton choix", "Un roman que tu choisis.", "📖", 3300, 4000);
      stmt.run("Skin Légendaire Overwatch", "Un skin Légendaire Overwatch au choix.", "👑", 4500, 5000);
      stmt.run("Sortie spéciale", "Musée, ciné, escape game ou similaire.", "🎟️", 5500, 6000);
      stmt.run("Bowling ou trampoline park", "Une sortie sportive et fun.", "🎳", 7000, null);
      stmt.run("Skin Mythique Overwatch", "Un skin Mythique Overwatch au choix.", "💎", 8000, 9000);
      stmt.run("Beau jeu d'échecs", "Un beau jeu d'échecs rien qu'à toi.", "♟️", 9000, null);
      stmt.run("Grande sortie", "Zoo, aquarium ou parc d'attractions.", "🦋", 12000, null);
      stmt.run("Bon 30 min console", "30 minutes de jeu console.", "🎮", 250, 750);
      stmt.run("Bon 1 h console", "1 heure de jeu console.", "🎮", 4000, 2500);
      stmt.run("Goûter spécial", "Un goûter de ton choix.", "🍪", 150, 670);
    })();
  }
}

function computeCurrentWeekStartIso() {
  const date = new Date();
  const day = date.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - daysFromMonday);
  return formatLocalDate(date);
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

export function resetDatabase() {
  const db = getDb();

  db.transaction(() => {
    db.exec(`
      DELETE FROM manual_badge_unlocks;
      DELETE FROM goal_bonuses;
      DELETE FROM daily_entries;
      DELETE FROM weekly_goals;
      DELETE FROM rewards;
      DELETE FROM badges;
      DELETE FROM task_types;
    `);
    db.exec(`
      DELETE FROM sqlite_sequence
      WHERE name IN ('goal_bonuses','daily_entries','weekly_goals','rewards','badges','task_types');
    `);
    seedDefaults(db);
  })();
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

export function updateTaskTypePoints(id: number, pointsPerUnit: number) {
  getDb()
    .prepare("UPDATE task_types SET points_per_unit = ? WHERE id = ?")
    .run(pointsPerUnit, id);
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
  intervalPoints: number | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO rewards (name, description, icon, required_points, interval_points)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.name, input.description, input.icon, input.requiredPoints, input.intervalPoints);
}

export function updateReward(input: {
  id: number;
  name: string;
  description: string;
  icon: string;
  requiredPoints: number;
  intervalPoints: number | null;
}) {
  getDb()
    .prepare(
      `UPDATE rewards
       SET name = ?, description = ?, icon = ?, required_points = ?, interval_points = ?
       WHERE id = ?`
    )
    .run(
      input.name,
      input.description,
      input.icon,
      input.requiredPoints,
      input.intervalPoints,
      input.id
    );
}

export function activateReward(id: number) {
  const db = getDb();
  const totalPoints = getTotalPoints();
  const reward = db
    .prepare(
      `SELECT required_points as requiredPoints, interval_points as intervalPoints,
              times_activated as timesActivated
       FROM rewards WHERE id = ?`
    )
    .get(id) as
    | { requiredPoints: number; intervalPoints: number | null; timesActivated: number }
    | undefined;

  if (!reward) return;

  const timesUnlocked = computeTimesUnlocked(
    totalPoints,
    reward.requiredPoints,
    reward.intervalPoints
  );

  if (reward.timesActivated < timesUnlocked) {
    db.prepare("UPDATE rewards SET times_activated = times_activated + 1 WHERE id = ?").run(id);
  }
}

export function validateRewardClaim(id: number) {
  const db = getDb();
  const reward = db
    .prepare(
      `SELECT times_activated as timesActivated, times_claimed as timesClaimed
       FROM rewards WHERE id = ?`
    )
    .get(id) as { timesActivated: number; timesClaimed: number } | undefined;

  if (!reward) return;

  if (reward.timesClaimed < reward.timesActivated) {
    db.prepare("UPDATE rewards SET times_claimed = times_claimed + 1 WHERE id = ?").run(id);
  }
}

export function deleteReward(id: number) {
  getDb().prepare("DELETE FROM rewards WHERE id = ?").run(id);
}

function computeTimesUnlocked(
  totalPoints: number,
  requiredPoints: number,
  intervalPoints: number | null
) {
  if (totalPoints < requiredPoints) return 0;
  if (intervalPoints == null || intervalPoints <= 0) return 1;
  return Math.floor((totalPoints - requiredPoints) / intervalPoints) + 1;
}

export function createBadge(input: {
  name: string;
  description: string;
  icon: string;
  xp: number;
  conditionType: string;
  conditionValue: number;
}) {
  getDb()
    .prepare(
      `INSERT INTO badges (name, description, icon, xp, condition_type, condition_value)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(input.name, input.description, input.icon, input.xp, input.conditionType, input.conditionValue);
}

export function deleteBadge(id: number) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM manual_badge_unlocks WHERE badge_id = ?").run(id);
    db.prepare("DELETE FROM badges WHERE id = ?").run(id);
  })();
}

export function grantBadgeManually(id: number) {
  getDb().prepare("INSERT OR IGNORE INTO manual_badge_unlocks (badge_id) VALUES (?)").run(id);
}

export function revokeBadgeManually(id: number) {
  getDb().prepare("DELETE FROM manual_badge_unlocks WHERE badge_id = ?").run(id);
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
  })();
}

export function addDailyEntryForDate(taskTypeId: number, date: string, quantity = 1) {
  const db = getDb();

  db.transaction(() => {
    const task = db
      .prepare("SELECT id FROM task_types WHERE id = ?")
      .get(taskTypeId);

    if (!task) {
      return;
    }

    db.prepare(
      `INSERT INTO daily_entries (task_type_id, entry_date, quantity)
       VALUES (?, ?, ?)`
    ).run(taskTypeId, date, quantity);

    awardReachedWeeklyBonuses(date);
  })();
}

export function removeLastDailyEntry(taskTypeId: number) {
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `DELETE FROM daily_entries
       WHERE id = (
         SELECT id
         FROM daily_entries
         WHERE task_type_id = ? AND entry_date = ?
         ORDER BY id DESC
         LIMIT 1
       )`
    ).run(taskTypeId, formatLocalDate());

    revokeGoalBonusesBelowTarget();
    clampRewardCountersToUnlocks();
  })();
}

function revokeGoalBonusesBelowTarget() {
  const db = getDb();
  const bonuses = db
    .prepare(
      `SELECT
        gb.id as bonusId,
        wg.task_type_id as taskTypeId,
        wg.target_quantity as targetQuantity,
        wg.week_start as weekStart
       FROM goal_bonuses gb
       JOIN weekly_goals wg ON wg.id = gb.weekly_goal_id`
    )
    .all() as {
      bonusId: number;
      taskTypeId: number;
      targetQuantity: number;
      weekStart: string;
    }[];

  for (const b of bonuses) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(quantity), 0) as quantity
         FROM daily_entries
         WHERE task_type_id = ?
          AND entry_date BETWEEN ? AND ?`
      )
      .get(b.taskTypeId, b.weekStart, addDays(b.weekStart, 6)) as {
        quantity: number;
      };

    if (row.quantity < b.targetQuantity) {
      db.prepare("DELETE FROM goal_bonuses WHERE id = ?").run(b.bonusId);
    }
  }
}

function clampRewardCountersToUnlocks() {
  const db = getDb();
  const totalPoints = getTotalPoints();
  const rewards = db
    .prepare(
      `SELECT id, required_points as requiredPoints, interval_points as intervalPoints,
              times_activated as timesActivated, times_claimed as timesClaimed
       FROM rewards`
    )
    .all() as {
      id: number;
      requiredPoints: number;
      intervalPoints: number | null;
      timesActivated: number;
      timesClaimed: number;
    }[];

  for (const r of rewards) {
    const timesUnlocked = computeTimesUnlocked(
      totalPoints,
      r.requiredPoints,
      r.intervalPoints
    );
    const newActivated = Math.min(r.timesActivated, timesUnlocked);
    const newClaimed = Math.min(r.timesClaimed, newActivated);

    if (newActivated !== r.timesActivated || newClaimed !== r.timesClaimed) {
      db.prepare(
        "UPDATE rewards SET times_activated = ?, times_claimed = ? WHERE id = ?"
      ).run(newActivated, newClaimed, r.id);
    }
  }
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
  const badges = getBadges(getMaxStreak());
  const badgePoints = badges.filter(b => b.earned).reduce((sum, b) => sum + b.xp, 0);
  return getWorkPoints() + getBonusPoints() + badgePoints;
}

function awardReachedWeeklyBonuses(forDate: string = formatLocalDate()) {
  const db = getDb();
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
    .all(forDate) as {
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

function getRewards(totalPoints: number): Reward[] {
  const rows = getDb()
    .prepare(
      `SELECT
        id,
        name,
        description,
        icon,
        required_points as requiredPoints,
        interval_points as intervalPoints,
        times_activated as timesActivated,
        times_claimed as timesClaimed
       FROM rewards
       ORDER BY required_points ASC, id ASC`
    )
    .all() as {
    id: number;
    name: string;
    description: string;
    icon: string;
    requiredPoints: number;
    intervalPoints: number | null;
    timesActivated: number;
    timesClaimed: number;
  }[];

  return rows.map((r) => {
    const timesUnlocked = computeTimesUnlocked(totalPoints, r.requiredPoints, r.intervalPoints);
    const timesAvailable = Math.max(0, timesUnlocked - r.timesActivated);
    const timesPending = Math.max(0, r.timesActivated - r.timesClaimed);
    let nextUnlockAt: number | null;
    if (r.intervalPoints == null) {
      nextUnlockAt = timesUnlocked === 0 ? r.requiredPoints : null;
    } else {
      nextUnlockAt = r.requiredPoints + r.intervalPoints * timesUnlocked;
    }

    return {
      id: r.id,
      name: r.name,
      description: r.description,
      icon: r.icon,
      requiredPoints: r.requiredPoints,
      intervalPoints: r.intervalPoints,
      timesUnlocked,
      timesActivated: r.timesActivated,
      timesClaimed: r.timesClaimed,
      timesAvailable,
      timesPending,
      nextUnlockAt
    };
  });
}

function getMaxStreak() {
  const dates = getDb()
    .prepare(
      `SELECT entry_date as entryDate
       FROM daily_entries
       GROUP BY entry_date
       ORDER BY entry_date ASC`
    )
    .all() as { entryDate: string }[];

  let maxStreak = 0;
  let currentRun = 0;
  let prevDate: string | null = null;

  for (const { entryDate } of dates) {
    if (prevDate !== null && entryDate === addDays(prevDate, 1)) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    if (currentRun > maxStreak) maxStreak = currentRun;
    prevDate = entryDate;
  }

  return maxStreak;
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

  let streak = 0;
  let expectedDate = today;

  for (let i = 0; i < dates.length; i++) {
    const row = dates[i];
    if (row.entryDate === expectedDate) {
      streak += 1;
      expectedDate = addDays(expectedDate, -1);
    } else if (i === 0 && row.entryDate === addDays(today, -1)) {
      // Allow skipping 'today' if we are on the first record and it's yesterday
      streak += 1;
      expectedDate = addDays(row.entryDate, -1);
    } else if (row.entryDate < expectedDate) {
      break;
    }
  }

  return streak;
}

function getBadges(maxStreak: number) {
  const db = getDb();
  const badges = db.prepare(`SELECT * FROM badges ORDER BY id ASC`).all() as {
    id: number;
    name: string;
    description: string;
    icon: string;
    xp: number;
    condition_type: string;
    condition_value: number;
  }[];

  const row = db
    .prepare(
      `SELECT
        COALESCE(SUM(de.quantity), 0) as totalUnits,
        COALESCE(SUM(CASE WHEN LOWER(tt.name) LIKE '%puzzle%' THEN de.quantity ELSE 0 END), 0) as puzzleUnits,
        COALESCE(SUM(CASE WHEN LOWER(tt.name) LIKE '%bot%' THEN de.quantity ELSE 0 END), 0) as botUnits
       FROM daily_entries de
       JOIN task_types tt ON tt.id = de.task_type_id`
    )
    .get() as { totalUnits: number; puzzleUnits: number; botUnits: number };
    
  const bonusRow = db
    .prepare("SELECT COUNT(*) as count FROM goal_bonuses")
    .get() as { count: number };

  const manualUnlocks = db.prepare("SELECT badge_id FROM manual_badge_unlocks").all() as { badge_id: number }[];
  const manualUnlockSet = new Set(manualUnlocks.map(r => r.badge_id));

  return badges.map((b) => {
    const manuallyEarned = manualUnlockSet.has(b.id);
    let earned = manuallyEarned;

    if (!earned) {
      switch (b.condition_type) {
        case "total_units":
          earned = row.totalUnits >= b.condition_value;
          break;
        case "puzzle_units":
          earned = row.puzzleUnits >= b.condition_value;
          break;
        case "bot_units":
          earned = row.botUnits >= b.condition_value;
          break;
        case "streak":
          earned = maxStreak >= b.condition_value;
          break;
        case "weekly_goals":
          earned = bonusRow.count >= b.condition_value;
          break;
        default:
          earned = false;
          break;
      }
    }

    return {
      id: b.id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      xp: b.xp,
      conditionType: b.condition_type,
      conditionValue: b.condition_value,
      earned,
      manuallyEarned
    };
  }) satisfies Badge[];
}

function getRecentActivity(today: string, minDays = 14): DailyStatus[] {
  const dates = getDb()
    .prepare(
      `SELECT entry_date as entryDate
       FROM daily_entries
       GROUP BY entry_date
       ORDER BY entry_date ASC`
    )
    .all() as { entryDate: string }[];

  const activeDates = new Set(dates.map(d => d.entryDate));

  // Span every day from the first recorded entry (or `minDays` ago, whichever
  // is earlier) through today, so the streak strip can be scrolled across the
  // whole history.
  const earliestByMin = addDays(today, -(minDays - 1));
  const firstEntry = dates.length > 0 ? dates[0].entryDate : earliestByMin;
  const start = firstEntry < earliestByMin ? firstEntry : earliestByMin;

  const result: DailyStatus[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    result.push({
      date: d,
      active: activeDates.has(d),
      isToday: d === today
    });
  }
  return result;
}

export function getAppState(): AppState {
  awardReachedWeeklyBonuses();

  const today = formatLocalDate();
  const currentWeekStart = getCurrentWeekStart();
  const workPoints = getWorkPoints();
  const bonusPoints = getBonusPoints();
  const streak = getStreak(today);
  const badges = getBadges(getMaxStreak());
  const badgePoints = badges.filter(b => b.earned).reduce((sum, b) => sum + b.xp, 0);
  const totalPoints = workPoints + bonusPoints + badgePoints;
  const level = Math.floor(totalPoints / 100) + 1;

  return {
    today,
    currentWeekStart,
    totalPoints,
    workPoints,
    bonusPoints,
    badgePoints,
    level,
    nextLevelAt: level * 100,
    streak,
    recentActivity: getRecentActivity(today, 14),
    todayTasks: getTodayTasks(today),
    taskTypes: getTaskTypes(),
    weeklyGoals: getWeeklyGoals(currentWeekStart),
    rewards: getRewards(totalPoints),
    badges
  };
}
