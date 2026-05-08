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
  toggleTaskType,
  toggleWeeklyGoal
} from "@/app/actions";
import { getAppState, type AppState, type Reward, type WeeklyGoal } from "@/lib/db";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{
    login?: string;
  }>;
};

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

function rewardStatusLabel(status: "locked" | "unlocked" | "claimed") {
  if (status === "claimed") {
    return "récupérée";
  }

  if (status === "unlocked") {
    return "débloquée";
  }

  return "verrouillée";
}

function activeStatusLabel(active: boolean) {
  return active ? "active" : "en pause";
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
          {state.workPoints} travail + {state.bonusPoints} bonus
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

function WeeklyGoals({ state }: { state: AppState }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cette semaine</p>
          <h2>Objectifs hebdomadaires</h2>
        </div>
        <span className="pill">Début le {formatDate(state.currentWeekStart)}</span>
      </div>

      {state.weeklyGoals.length > 0 ? (
        <div className="goal-list">
          {state.weeklyGoals.map((goal) => (
            <article className="goal-card" key={goal.id}>
              <div className="goal-title">
                <span className="icon-badge">{goal.taskIcon}</span>
                <div>
                  <strong>{goal.taskName}</strong>
                  <span>
                    {goal.progressQuantity} / {goal.targetQuantity}{" "}
                    {goal.unitLabel}
                    {goal.targetQuantity === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent(goal)}%` }}
                />
              </div>
              <small>
                Bonus: {goal.bonusPoints} XP{" "}
                {goal.bonusAwarded ? "(attribué)" : "(débloqué une fois atteint)"}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">Aucun objectif hebdomadaire pour le moment.</p>
      )}
    </section>
  );
}

function XpAdventure({ state }: { state: AppState }) {
  const maxRewardPoints = state.rewards.length > 0
    ? Math.max(...state.rewards.map(r => r.requiredPoints))
    : 0;

  const maxPoints = Math.max(state.nextLevelAt, maxRewardPoints);
  const progressPercent = Math.min(100, Math.round((state.totalPoints / maxPoints) * 100));

  return (
    <section className="xp-adventure-single">
      <div className="xp-hero-content">
        <p className="eyebrow">Aventure XP</p>
        <h2>Niveau {state.level}</h2>
        <strong>{state.totalPoints} XP</strong>
        <p>
          Encore {Math.max(0, state.nextLevelAt - state.totalPoints)} XP pour
          atteindre le niveau {state.level + 1}.
        </p>
      </div>

      <div className="progress-container">
        <div className="progress-track big">
          <div
            className="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {state.rewards.map((reward) => {
          const rewardPercent = Math.min(100, (reward.requiredPoints / maxPoints) * 100);

          let markerClass = "reward-marker ";
          if (reward.status === "claimed") markerClass += "claimed";
          else if (reward.status === "unlocked") markerClass += "unlocked";
          else markerClass += "locked";

          return (
            <div
              key={reward.id}
              className={markerClass}
              style={{ left: `${rewardPercent}%` }}
            >
              <div className="reward-dot" title={`${reward.name} (${reward.requiredPoints} XP)`}>
                {reward.icon}
              </div>
              <div className="reward-label">
                <strong>{reward.name}</strong>
                <small>{reward.requiredPoints} XP</small>
              </div>
            </div>
          );
        })}
      </div>

      {state.rewards.length === 0 ? (
        <p className="empty">
          Demande à l&apos;admin d&apos;ajouter des récompenses pour créer le chemin.
        </p>
      ) : null}
    </section>
  );
}

function ChildDashboard({ state }: { state: AppState }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Aujourd&apos;hui, nous sommes le {formatDate(state.today)}
          </p>
          <h1>Bonjour Abi.</h1>
        </div>
        <form action={logout}>
          <button className="ghost-button" type="submit">
            Se déconnecter
          </button>
        </form>
      </header>

      <XpAdventure state={state} />

      <section className="panel activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aujourd&apos;hui</p>
            <h2>Choisis une activité</h2>
          </div>
          <span className="pill">Série: {state.streak} jour{state.streak === 1 ? "" : "s"}</span>
        </div>

        {state.todayTasks.length > 0 ? (
          <div className="task-grid">
            {state.todayTasks.map((task) => (
              <article className="task-card" key={task.taskTypeId}>
                <div className="task-card-header">
                  <span className="task-icon">{task.icon}</span>
                  <span className="pill">+{task.pointsPerUnit} XP</span>
                </div>
                <h3>{task.name}</h3>
                <p>Appuie quand tu termines 1 {task.unitLabel}.</p>
                <div className="today-score">
                  <strong>{task.quantity}</strong>
                  <span>
                    {task.unitLabel}
                    {task.quantity === 1 ? " " : "s "} aujourd&apos;hui
                  </span>
                  <small>{task.pointsEarned} XP gagnés</small>
                </div>
                <form action={recordWork}>
                  <input name="taskTypeId" type="hidden" value={task.taskTypeId} />
                  <button className="task-button" type="submit">
                    J&apos;ai terminé +1
                  </button>
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

      <WeeklyGoals state={state} />

      <section className="two-column">
        <div className="panel">
          <p className="eyebrow">Badges</p>
          <h2>Collection</h2>
          <ul className="badge-list">
            {state.badges.map((badge) => (
              <li className={badge.earned ? "earned" : ""} key={badge.name}>
                <strong>{badge.name}</strong>
                <small>{badge.description}</small>
              </li>
            ))}
          </ul>
        </div>

        <StatCards state={state} />
      </section>
    </main>
  );
}

function AdminDashboard({ state }: { state: AppState }) {
  const activeTaskTypes = state.taskTypes.filter((task) => task.active);

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
                    {task.pointsPerUnit} XP par {task.unitLabel} /{" "}
                    {activeStatusLabel(task.active)}
                  </small>
                </span>
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
                    {rewardStatusLabel(reward.status)} à {reward.requiredPoints} XP
                  </small>
                </span>
                <span className="row-actions">
                  {reward.status === "unlocked" ? (
                    <form action={markRewardClaimed}>
                      <input name="id" type="hidden" value={reward.id} />
                      <button className="small-button" type="submit">
                        Marquer comme récupérée
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
      </section>

      <WeeklyGoals state={state} />
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
    return <AdminDashboard state={state} />;
  }

  return <ChildDashboard state={state} />;
}
