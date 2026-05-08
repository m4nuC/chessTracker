# Abi Chess Tracker

Abi Chess Tracker is a small standalone web application for tracking Abi's
chess practice progress in a positive, gamified way.

The current app is a first working MVP: one child user, one admin space,
cookie-based sessions, a French UI, and SQLite persistence.

## Current Status

Implemented so far:

- French user interface with `lang="fr"` metadata.
- Child login and remembered session via an HTTP-only cookie.
- Admin login with a separate password.
- Admin creation of task types, weekly goals, and custom rewards.
- Admin pause/activate controls for task types and weekly goals.
- Child daily tracker with `+1` buttons for active task types.
- Total XP, work XP, bonus XP, level, and streak display.
- Weekly progress bars based on completed quantities.
- One-time weekly bonus XP when a goal is reached.
- Reward unlocking at XP milestones.
- Admin marking unlocked rewards as claimed.
- Admin deleting activities and rewards.
- Built-in badge display for early achievements.
- SQLite storage in a local `data/app.db` file by default.

Not implemented yet:

- Editing existing task types, weekly goals, or rewards.
- Deleting weekly goals directly.
- Admin correction of daily entries.
- Multiple children.
- Numeric entry beyond the current `+1` buttons.
- Rich animations, confetti, or point burst effects.
- Complex analytics.
- Configurable badge rules.

## Stack

- Next.js App Router
- TypeScript
- SQLite via `better-sqlite3`
- Local file persistence through `DATA_DIR`

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Local development passwords:

- Child: `abi`
- Admin: `admin`

You can override them with environment variables:

```txt
CHILD_PASSWORD=your-child-password
ADMIN_PASSWORD=your-admin-password
```

## App Flow

1. Admin logs in.
2. Admin creates active task types, such as `Puzzles`, `Parties bot`, or
   `Ouvertures`.
3. Admin creates weekly goals for the current week.
4. Admin creates rewards with required XP milestones.
5. Abi logs in.
6. Abi records completed work with the `+1` buttons.
7. The app updates XP, level, streak, weekly progress, badges, bonuses, and
   reward unlocks.

## Authentication

Authentication is intentionally simple:

- The child password grants access to Abi's tracker.
- The admin password grants access to management forms.
- A successful login creates a long-lived HTTP-only cookie session.
- If the cookie is removed or expires, the user can log in again with the
  relevant password.

There is no OAuth, email login, or external identity provider.

## Data Model

The SQLite database currently stores:

- `sessions`: cookie-backed login sessions.
- `task_types`: admin-created chess work categories.
- `weekly_goals`: weekly quantity targets and bonus XP.
- `daily_entries`: completed work by date and task type.
- `goal_bonuses`: one-time records that a weekly bonus was awarded.
- `rewards`: custom rewards with locked, unlocked, or claimed status.

Badges, totals, weekly progress, levels, streaks, and reward eligibility are
derived from stored entries where practical.

## Points, XP, Levels, And Streaks

The current scoring model is deliberately simple:

- Completing work grants XP.
- `XP = completed quantity * task XP value`.
- Weekly goal bonuses add bonus XP once per goal.
- Total XP equals work XP plus bonus XP.
- Levels are based on 100 XP steps.
- A day counts toward the streak if Abi records any chess work that day.

Rewards unlock when total XP reaches their required milestone. Claimed is a
separate admin-managed state so a reward can stay visibly earned until it has
been fulfilled.

## Persistence

By default, SQLite data is stored at:

```txt
data/app.db
```

For deployment, set `DATA_DIR` to a persistent mounted directory. For example,
on Railway:

```txt
DATA_DIR=/data
```

## Deployment Notes

The intended deployment shape is still one service:

- One Next.js app.
- One persistent volume for SQLite.
- No separate backend service.
- No hosted database required for the current MVP.

Make sure production sets:

```txt
CHILD_PASSWORD=...
ADMIN_PASSWORD=...
DATA_DIR=/data
```

## Useful Commands

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

The latest verified checks were:

```bash
npm run lint
npm run typecheck
npm run build
```
