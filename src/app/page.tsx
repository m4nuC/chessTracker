import {
  addReward,
  addTaskType,
  addWeeklyGoal,
  deleteReward,
  deleteTaskType,
  getCurrentSession,
  login,
  logout,
  markRewardClaimed,
  recordWork,
  recordWorkForDate,
  resetDatabase,
  toggleTaskType,
  toggleWeeklyGoal,
  activateReward,
  updateTaskTypePoints,
  updateReward,
  grantBadge,
  revokeBadge,
  addBadge,
  deleteBadge
} from "@/app/actions";
import { getAppState, type AppState, type Reward, type WeeklyGoal } from "@/lib/db";
import { XpCarousel } from "@/components/XpCarousel";
import { BadgeUnlockPopup } from "@/components/BadgeUnlockPopup";
import { RewardUnlockPopup } from "@/components/RewardUnlockPopup";
import { RewardsModal } from "@/components/RewardsModal";
import { TaskCompleteButton } from "@/components/TaskCompleteButton";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{
    login?: string;
    reset?: string;
  }>;
};

type ResetNotice = "ok" | "invalid" | null;

function progressPercent(goal: WeeklyGoal) {
  return Math.min(100, Math.round((goal.progressQuantity / goal.targetQuantity) * 100));
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function activeStatusLabel(active: boolean) {
  return active ? "active" : "en pause";
}

function rewardMarkerTarget(reward: Reward) {
  const outstanding = reward.timesAvailable > 0 || reward.timesPending > 0;
  if (outstanding && reward.intervalPoints != null && reward.timesUnlocked > 0) {
    return reward.requiredPoints + reward.intervalPoints * (reward.timesUnlocked - 1);
  }
  return reward.nextUnlockAt !== null ? reward.nextUnlockAt : reward.requiredPoints;
}



function LoginPanel({ loginFailed }: { loginFailed: boolean }) {
  return (
    <main className="page">
      <section className="hero-card">
        <p className="eyebrow">Suivi d&apos;échecs d&apos;Abi</p>
        <h1>Suis tes entraînements d&apos;échecs et débloque des récompenses.</h1>
        <p>
          Connecte-toi en tant qu&apos;Abi pour noter le travail du jour, ou en tant
          qu&apos;admin pour préparer les activités, les objectifs de la semaine et
          les récompenses.
        </p>

        {loginFailed ? (
          <p className="notice danger">
            Ce mot de passe ne correspond pas. Réessaie.
          </p>
        ) : null}

        <div className="login-grid">
          <form action={login} className="panel form-stack">
            <input name="role" type="hidden" value="child" />
            <h2>Connexion d&apos;Abi</h2>
            <label>
              Mot de passe enfant
              <input name="password" type="password" placeholder="abi" required />
            </label>
            <button className="primary-button" type="submit">
              Ouvrir le suivi
            </button>
          </form>

          <form action={login} className="panel form-stack">
            <input name="role" type="hidden" value="admin" />
            <h2>Connexion admin</h2>
            <label>
              Mot de passe admin
              <input name="password" type="password" placeholder="admin" required />
            </label>
            <button className="secondary-button" type="submit">
              Gérer l&apos;application
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function StatCards({ state }: { state: AppState }) {
  return (
    <section className="stats" aria-label="Résumé de la progression">
      <article className="stat-card">
        <span>Total XP</span>
        <strong>{state.totalPoints}</strong>
        <small>
          {state.workPoints} travail + {state.bonusPoints} bonus +{" "}
          {state.badgePoints} badges
        </small>
      </article>
      <article className="stat-card">
        <span>Niveau</span>
        <strong>{state.level}</strong>
        <small>
          {state.nextLevelAt - state.totalPoints} XP avant le prochain niveau
        </small>
      </article>
      <article className="stat-card">
        <span>Serie</span>
        <strong>{state.streak}</strong>
        <small>jours avec des échecs</small>
      </article>
    </section>
  );
}

function VisualStreak({ state }: { state: AppState }) {
  return (
    <section className="panel streak-panel">
      <div className="streak-header">
        <p className="eyebrow">Activité récente</p>
        <span className="pill">Série en cours: {state.streak} jour{state.streak === 1 ? "" : "s"}</span>
      </div>
      <div className="streak-row">
        {state.recentActivity.map((day) => (
          <div 
            key={day.date} 
            className={`streak-day ${day.active ? 'active' : 'inactive'} ${day.isToday ? 'today' : ''}`} 
            title={formatDate(day.date)}
          >
            <span className="streak-icon">{day.active ? '🔥' : '🌑'}</span>
            <span className="streak-date">{new Date(day.date).getDate()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyGoals({ state }: { state: AppState }) {
  return (
    <section className="panel goals-panel">
      <div className="goals-header">
        <p className="eyebrow">Cette semaine</p>
        <h2>Objectifs</h2>
        <span className="pill purple-pill">Début {formatDate(state.currentWeekStart)}</span>
      </div>

      <hr className="goals-divider" />

      {state.weeklyGoals.length > 0 ? (
        <div className="goal-bars-container">
          {state.weeklyGoals.map((goal) => (
            <div className="goal-bar-col" key={goal.id}>
              <div className="vertical-track">
                <div
                  className="vertical-fill"
                  style={{ height: `${progressPercent(goal)}%` }}
                />
              </div>
              <div className="goal-bar-icon">{goal.taskIcon}</div>
              <span className="goal-bar-text">
                {goal.progressQuantity}/{goal.targetQuantity}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">Aucun objectif hebdomadaire pour le moment.</p>
      )}
    </section>
  );
}

function XpAdventure({ state, previewAll = false }: { state: AppState; previewAll?: boolean }) {
  const rewardTargets = state.rewards.map(rewardMarkerTarget);

  const previousTargets = rewardTargets.filter(p => p <= state.totalPoints).sort((a, b) => b - a);
  const prevTarget = previousTargets.length > 0 ? previousTargets[0] : 0;

  const upcomingTargets = rewardTargets.filter(p => p > state.totalPoints).sort((a, b) => a - b);
  const nextTarget = upcomingTargets.length > 0 ? upcomingTargets[0] : Math.max(state.totalPoints + 100, prevTarget + 300);

  // Fog of war grouping
  const sortedGroups = Array.from(
    state.rewards.reduce((map, reward) => {
      const targetPoints = rewardMarkerTarget(reward);
      const group = map.get(targetPoints) ?? [];
      group.push(reward);
      map.set(targetPoints, group);
      return map;
    }, new Map<number, Reward[]>())
  ).sort((a, b) => a[0] - b[0]);

  const pastOrPresentGroups = sortedGroups.filter(([tp]) => tp <= state.totalPoints);
  const futureGroups = sortedGroups.filter(([tp]) => tp > state.totalPoints);

  const visibleFutureGroups = previewAll ? futureGroups : futureGroups.slice(0, 3);
  const hasHiddenGroups = previewAll ? false : futureGroups.length > 3;

  const visibleGroups = [...pastOrPresentGroups, ...visibleFutureGroups];

  const lastVisibleTarget = visibleGroups.length > 0 ? visibleGroups[visibleGroups.length - 1][0] : 0;
  const fogOfWarPoints = lastVisibleTarget + 100;
  
  const maxPoints = Math.max(state.totalPoints + 50, hasHiddenGroups ? fogOfWarPoints : lastVisibleTarget);

  // Use a fixed zoom level so that ~350 XP corresponds to one full screen width.
  // This ensures consistent spacing between rewards and prevents icon overlap.
  const visibleXP = 350;

  const containerWidthPercent = Math.max(100, (maxPoints / visibleXP) * 100);

  const progressPercent = Math.min(100, (state.totalPoints / maxPoints) * 100);

  return (
    <section className="xp-adventure-single">
      <div className="xp-hero-content">
        <div>
          <p className="eyebrow">Aventure XP</p>
          <h2>⭐️ {state.totalPoints} XP</h2>
        </div>
        <span className="pill">
          Encore {Math.max(0, nextTarget - state.totalPoints)} XP avant la prochaine récompense !
        </span>
      </div>

      <XpCarousel>
        <div
          className="progress-container"
          style={{ minWidth: `${containerWidthPercent}%` }}
        >
          <div className="progress-track-area">
            <div className="progress-track big">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {visibleGroups.map(([targetPoints, group]) => {
              const rewardPercent = Math.min(100, (targetPoints / maxPoints) * 100);

              const isFuture = targetPoints > state.totalPoints;

              let markerClass = "reward-marker ";
              if (group.some((r) => r.timesAvailable > 0 || r.timesPending > 0))
                markerClass += "unlocked";
              else if (group.some((r) => r.timesClaimed > 0 && r.nextUnlockAt === null))
                markerClass += "claimed";
              else markerClass += "locked";

              if (isFuture) {
                markerClass += " blurred";
              }

              const titleText = isFuture && !previewAll
                ? "Mystère"
                : group
                    .map((r) => `${r.name} (${targetPoints} XP)`)
                    .join(" · ");

              return (
                <div
                  key={`group-${targetPoints}`}
                  className={markerClass}
                  style={{ left: `${rewardPercent}%` }}
                >
                  <div className="reward-dot" title={titleText}>
                    {group.map((r) => r.icon).join("")}
                  </div>
                  <div className="reward-label">
                    {group.map((r) => (
                      <strong key={r.id}>{r.name}</strong>
                    ))}
                    <small>{targetPoints} XP</small>
                  </div>
                </div>
              );
            })}

            {hasHiddenGroups ? (
              <div
                className="reward-marker locked fog-of-war"
                style={{ left: `${Math.min(100, (fogOfWarPoints / maxPoints) * 100)}%` }}
              >
                <div className="reward-dot" title="Plus à découvrir !">
                  ☀️
                </div>
                <div className="reward-label">
                  <strong>Mystère</strong>
                  <small>Continue à jouer !</small>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </XpCarousel>

      {state.rewards.length === 0 ? (
        <p className="empty">
          Demande à l&apos;admin d&apos;ajouter des récompenses pour créer le chemin.
        </p>
      ) : null}

      <div className="clouds-container">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="clouds-svg">
          {/* Back layer */}
          <path 
            fill="rgba(255, 255, 255, 0.45)" 
            d="M 0 120 L 0 100 A 70 70 0 0 1 120 90 A 90 90 0 0 1 280 70 A 80 80 0 0 1 420 85 A 100 100 0 0 1 600 60 A 85 85 0 0 1 750 75 A 95 95 0 0 1 900 65 A 80 80 0 0 1 1050 80 A 90 90 0 0 1 1200 90 L 1200 120 Z" 
          />
          {/* Front layer */}
          <path 
            fill="#ffffff" 
            d="M 0 120 L 0 110 A 60 60 0 0 1 100 100 A 80 80 0 0 1 250 90 A 70 70 0 0 1 380 105 A 90 90 0 0 1 540 80 A 75 75 0 0 1 680 95 A 85 85 0 0 1 830 85 A 100 100 0 0 1 1000 100 A 60 60 0 0 1 1100 115 A 60 60 0 0 1 1200 110 L 1200 120 Z" 
          />
        </svg>
      </div>
    </section>
  );
}

function ChildDashboard({ state }: { state: AppState }) {
  const availableRewards = state.rewards.filter((r) => r.timesAvailable > 0);

  return (
    <main className="app-shell">
      <BadgeUnlockPopup badges={state.badges} />
      <RewardUnlockPopup rewards={state.rewards} />
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Aujourd&apos;hui, nous sommes le {formatDate(state.today)}
          </p>
          <h1>Bonjour Abi.</h1>
        </div>
        <div className="topbar-actions">
          <RewardsModal count={availableRewards.length}>
            {availableRewards.length > 0 ? (
              <div className="task-grid">
                {availableRewards.map((reward) => (
                  <article className="task-card" key={reward.id}>
                    <div className="task-card-header">
                      <span className="task-icon">{reward.icon}</span>
                    </div>
                    <h3>{reward.name}</h3>
                    <p>{reward.description}</p>
                    <form action={activateReward}>
                      <input name="id" type="hidden" value={reward.id} />
                      <button className="primary-button" type="submit">
                        Activer
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">
                Tu n&apos;as pas de récompenses disponibles pour le moment. Termine des activités pour en débloquer !
              </p>
            )}
          </RewardsModal>
          <form action={logout}>
            <button className="ghost-button" type="submit">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <XpAdventure state={state} />

      <VisualStreak state={state} />

      <section className="panel activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aujourd&apos;hui</p>
            <h2>Qu'as-tu fait aujourd'hui?</h2>
          </div>
        </div>

        {state.todayTasks.length > 0 ? (
          <div className="task-grid">
            {state.todayTasks.map((task) => (
              <article className="task-card compact" key={task.taskTypeId}>
                <div className="task-card-header">
                  <span className="task-icon">{task.icon}</span>
                  <div className="task-card-title">
                    <h3>{task.name}</h3>
                    <p>
                      {task.quantity} {task.unitLabel}{task.quantity === 1 ? "" : "s"} aujourd&apos;hui ({task.pointsEarned} XP)
                    </p>
                  </div>
                </div>
                <form action={recordWork} className="task-card-form">
                  <input name="taskTypeId" type="hidden" value={task.taskTypeId} />
                  <TaskCompleteButton
                    pointsPerUnit={task.pointsPerUnit}
                    label={
                      <span className="task-button-content">
                        <span className="task-button-action">+1 {task.unitLabel}</span>
                        <span className="task-button-xp">+{task.pointsPerUnit} XP</span>
                      </span>
                    }
                  />
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">
            Demande à l&apos;admin de créer une activité active avant de noter ton
            travail.
          </p>
        )}
      </section>

      <div className="dashboard-bottom-grid">
        <WeeklyGoals state={state} />

        <section className="panel badges-panel">
          <div className="badges-header">
            <p className="eyebrow">Badges</p>
            <h2>Collection</h2>
          </div>
          <div className="badge-cloud">
            {state.badges.map((badge) => (
              <div className={`badge-node ${badge.earned ? "earned" : "locked"}`} key={badge.name}>
                <div className="badge-icon">{badge.icon}</div>
                <div className="badge-tooltip">
                  <strong>{badge.name}</strong>
                  <small>{badge.description}</small>
                  <span className="badge-xp">+{badge.xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminDashboard({
  state,
  resetNotice
}: {
  state: AppState;
  resetNotice: ResetNotice;
}) {
  const activeTaskTypes = state.taskTypes.filter((task) => task.active);
  const defaultRetroDate = state.recentActivity.at(-2)?.date ?? state.today;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Espace admin</p>
          <h1>Gérer le suivi d&apos;échecs d&apos;Abi.</h1>
        </div>
        <form action={logout}>
          <button className="ghost-button" type="submit">
            Se déconnecter
          </button>
        </form>
      </header>

      <StatCards state={state} />

      <section className="admin-grid">
        <div className="panel form-stack">
          <p className="eyebrow">Activités</p>
          <h2>Créer une activité</h2>
          <form action={addTaskType} className="form-stack">
            <label>
              Nom
              <input name="name" placeholder="Puzzles" required />
            </label>
            <label>
              Icône ou texte amusant
              <input name="icon" placeholder="pawn" />
            </label>
            <label>
              XP par unité
              <input min="1" name="pointsPerUnit" type="number" defaultValue="2" />
            </label>
            <label>
              Libellé de l&apos;unité
              <input name="unitLabel" placeholder="puzzle" required />
            </label>
            <button className="primary-button" type="submit">
              Ajouter l&apos;activité
            </button>
          </form>

          <ul className="management-list">
            {state.taskTypes.map((task) => (
              <li key={task.id}>
                <span>
                  <strong>{task.icon} {task.name}</strong>
                  <small>
                    {activeStatusLabel(task.active)}
                  </small>
                </span>
                <form action={updateTaskTypePoints} className="inline-update-form">
                  <input name="id" type="hidden" value={task.id} />
                  <label className="sr-only">XP par {task.unitLabel}</label>
                  <div className="inline-input-group">
                    <input 
                      name="pointsPerUnit" 
                      type="number" 
                      min="1" 
                      defaultValue={task.pointsPerUnit} 
                      className="small-input"
                      style={{ width: "4rem" }}
                    />
                    <span className="unit-label">XP/{task.unitLabel}</span>
                    <button className="small-button primary" type="submit">OK</button>
                  </div>
                </form>
                <span className="row-actions">
                  <form action={toggleTaskType}>
                    <input name="id" type="hidden" value={task.id} />
                    <input name="active" type="hidden" value={String(!task.active)} />
                    <button className="small-button" type="submit">
                      {task.active ? "Mettre en pause" : "Activer"}
                    </button>
                  </form>
                  <form action={deleteTaskType}>
                    <input name="id" type="hidden" value={task.id} />
                    <button className="small-button danger" type="submit">
                      Supprimer
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel form-stack">
          <p className="eyebrow">Saisie rétroactive</p>
          <h2>Ajouter une activité passée</h2>
          <p>
            Pour rattraper un jour oublié. La quantité s&apos;ajoute au total
            de la date choisie et déclenche les bonus de la semaine concernée.
          </p>
          <form action={recordWorkForDate} className="form-stack">
            <label>
              Activité
              <select name="taskTypeId" required disabled={state.taskTypes.length === 0}>
                {state.taskTypes.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.icon} {task.name}
                    {task.active ? "" : " (en pause)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                name="date"
                type="date"
                max={state.today}
                defaultValue={defaultRetroDate}
                required
              />
            </label>
            <label>
              Quantité
              <input min="1" name="quantity" type="number" defaultValue="1" required />
            </label>
            <button
              className="primary-button"
              disabled={state.taskTypes.length === 0}
              type="submit"
            >
              Ajouter l&apos;activité
            </button>
          </form>
        </div>

        <div className="panel form-stack">
          <p className="eyebrow">Objectifs hebdomadaires</p>
          <h2>Créer un objectif</h2>
          <form action={addWeeklyGoal} className="form-stack">
            <label>
              Activite
              <select name="taskTypeId" required disabled={activeTaskTypes.length === 0}>
                {activeTaskTypes.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantité cible
              <input min="1" name="targetQuantity" type="number" defaultValue="50" />
            </label>
            <label>
              Bonus XP
              <input min="0" name="bonusPoints" type="number" defaultValue="30" />
            </label>
            <label>
              Début de semaine
              <input
                name="weekStart"
                type="date"
                defaultValue={state.currentWeekStart}
              />
            </label>
            <button
              className="primary-button"
              disabled={activeTaskTypes.length === 0}
              type="submit"
            >
              Ajouter l&apos;objectif
            </button>
          </form>

          <ul className="management-list">
            {state.weeklyGoals.map((goal) => (
              <li key={goal.id}>
                <span>
                  <strong>{goal.taskName}</strong>
                  <small>
                    {goal.progressQuantity}/{goal.targetQuantity} {goal.unitLabel}
                    {goal.targetQuantity === 1 ? "" : "s"} / {goal.bonusPoints} XP bonus
                  </small>
                </span>
                <form action={toggleWeeklyGoal}>
                  <input name="id" type="hidden" value={goal.id} />
                  <input name="active" type="hidden" value={String(!goal.active)} />
                  <button className="small-button" type="submit">
                    {goal.active ? "Mettre en pause" : "Activer"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel form-stack">
          <p className="eyebrow">Récompenses</p>
          <h2>Créer une récompense</h2>
          <form action={addReward} className="form-stack">
            <label>
              Nom
              <input name="name" placeholder="Carnet d'échecs" required />
            </label>
            <label>
              Description
              <textarea
                name="description"
                placeholder="Un carnet pour noter les parties."
              />
            </label>
            <label>
              Icône ou texte amusant
              <input name="icon" placeholder="trophy" />
            </label>
            <label>
              XP requis
              <input min="0" name="requiredPoints" type="number" defaultValue="250" />
            </label>
            <label>
              Répétable ?
              <input type="checkbox" name="repeatable" value="true" />
            </label>
            <label>
              Intervalle d&apos;XP (si répétable)
              <input min="1" name="intervalPoints" type="number" defaultValue="1000" />
            </label>
            <button className="primary-button" type="submit">
              Ajouter la récompense
            </button>
          </form>

          <ul className="management-list">
            {state.rewards.map((reward) => (
              <li key={reward.id}>
                <span>
                  <strong>{reward.icon} {reward.name}</strong>
                  <small>
                    {reward.timesUnlocked} fois débloquée | {reward.timesPending} en attente | Prochain: {reward.nextUnlockAt ?? "Max"} XP
                  </small>
                </span>
                <form action={updateReward} className="inline-update-form">
                  <input name="id" type="hidden" value={reward.id} />
                  <input name="name" type="hidden" value={reward.name} />
                  <input name="description" type="hidden" value={reward.description} />
                  <input name="icon" type="hidden" value={reward.icon} />
                  {reward.intervalPoints !== null && (
                    <input name="repeatable" type="hidden" value="true" />
                  )}
                  <div className="inline-input-group">
                    <label className="inline-label">
                      Requis:
                      <input 
                        name="requiredPoints" 
                        type="number" 
                        min="0" 
                        defaultValue={reward.requiredPoints} 
                        className="small-input"
                        style={{ width: "5rem" }}
                      />
                    </label>
                    {reward.intervalPoints !== null ? (
                      <label className="inline-label">
                        Intervalle:
                        <input 
                          name="intervalPoints" 
                          type="number" 
                          min="1" 
                          defaultValue={reward.intervalPoints} 
                          className="small-input"
                          style={{ width: "5rem" }}
                        />
                      </label>
                    ) : null}
                    <button className="small-button primary" type="submit">OK</button>
                  </div>
                </form>
                <span className="row-actions">
                  {reward.timesPending > 0 ? (
                    <form action={markRewardClaimed}>
                      <input name="id" type="hidden" value={reward.id} />
                      <button className="small-button" type="submit">
                        Marquer 1 comme récupérée
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteReward}>
                    <input name="id" type="hidden" value={reward.id} />
                    <button className="small-button danger" type="submit">
                      Supprimer
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel form-stack">
          <p className="eyebrow">Badges</p>
          <h2>Créer un badge</h2>
          <form action={addBadge} className="form-stack">
            <label>
              Nom
              <input name="name" placeholder="Expert en puzzles" required />
            </label>
            <label>
              Description
              <textarea
                name="description"
                placeholder="Tu as résolu beaucoup de puzzles !"
              />
            </label>
            <label>
              Icône (emoji)
              <input name="icon" placeholder="🧩" />
            </label>
            <label>
              XP
              <input min="0" name="xp" type="number" defaultValue="50" required />
            </label>
            <label>
              Condition
              <select name="conditionType" required>
                <option value="total_units">Unités totales (toutes activités)</option>
                <option value="puzzle_units">Unités de puzzles</option>
                <option value="bot_units">Parties contre bot</option>
                <option value="streak">Série de jours consécutifs</option>
                <option value="weekly_goals">Objectifs hebdomadaires atteints</option>
                <option value="manual">Manuel (débloqué par l'admin)</option>
              </select>
            </label>
            <label>
              Valeur cible
              <input min="0" name="conditionValue" type="number" defaultValue="10" required />
            </label>
            <button className="primary-button" type="submit">
              Créer le badge
            </button>
          </form>

          <ul className="management-list">
            {state.badges.map((badge) => (
              <li key={badge.id}>
                <span>
                  <strong>{badge.icon} {badge.name}</strong>
                  <small>
                    {badge.conditionType} = {badge.conditionValue} | +{badge.xp} XP
                  </small>
                  <small>
                    {badge.earned ? (badge.manuallyEarned ? "✅ Acquis (Manuel)" : "✅ Acquis") : "🔒 Verrouillé"}
                  </small>
                </span>
                <span className="row-actions">
                  {badge.earned ? (
                    badge.manuallyEarned && (
                      <form action={revokeBadge}>
                        <input name="id" type="hidden" value={badge.id} />
                        <button className="small-button" type="submit">
                          Révoquer
                        </button>
                      </form>
                    )
                  ) : (
                    <form action={grantBadge}>
                      <input name="id" type="hidden" value={badge.id} />
                      <button className="small-button primary" type="submit">
                        Débloquer
                      </button>
                    </form>
                  )}
                  <form action={deleteBadge}>
                    <input name="id" type="hidden" value={badge.id} />
                    <button className="small-button danger" type="submit">
                      Supprimer
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel form-stack admin-timeline-preview">
          <p className="eyebrow">Aperçu</p>
          <h2>Parcours de récompenses</h2>
          <div className="preview-timeline-wrapper">
            <XpAdventure state={state} previewAll={true} />
          </div>
        </div>
      </section>

      <WeeklyGoals state={state} />

      <section className="panel form-stack">
        <p className="eyebrow">Zone dangereuse</p>
        <h2>Réinitialiser la base de données</h2>
        <p>
          Supprime tous les progrès, activités, objectifs et récompenses, puis
          recharge les valeurs par défaut. Cette action est irréversible.
        </p>

        {resetNotice === "ok" ? (
          <p className="notice">Base de données réinitialisée.</p>
        ) : null}
        {resetNotice === "invalid" ? (
          <p className="notice danger">
            Tu dois taper RESET exactement pour confirmer.
          </p>
        ) : null}

        <form action={resetDatabase} className="form-stack">
          <label>
            Tape RESET pour confirmer
            <input
              autoComplete="off"
              name="confirm"
              placeholder="RESET"
              required
            />
          </label>
          <button className="small-button danger" type="submit">
            Tout réinitialiser
          </button>
        </form>
      </section>
    </main>
  );
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const session = await getCurrentSession();

  if (!session) {
    return <LoginPanel loginFailed={params?.login === "failed"} />;
  }

  const state = getAppState();

  if (session.role === "admin") {
    const reset = params?.reset;
    const resetNotice: ResetNotice =
      reset === "ok" || reset === "invalid" ? reset : null;
    return <AdminDashboard state={state} resetNotice={resetNotice} />;
  }

  return <ChildDashboard state={state} />;
}
