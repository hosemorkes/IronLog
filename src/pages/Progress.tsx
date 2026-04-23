import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ACHIEVEMENTS,
  buildWeekActivity,
  computeCurrentStreak,
  computeUnlockedAchievementIds,
  countLogsThisMonth,
  countPrsAchievedInWeek,
  detectNewAchievements,
  exerciseNameForPr,
  formatNumberKg,
  formatPrDate,
  getMilestoneProgress,
  isPrFromThisWeek,
  percentChange,
  plannedSessionsThisWeek,
  previousWeekRange,
  readPersonalRecords,
  readWorkoutLogs,
  readWorkoutTemplates,
  topPersonalRecords,
  totalTonnageFromLogs,
  tonnageInRange,
  weekRangeMonday,
} from '../utils/stats'
import './Progress.css'

function useProgressDataRev() {
  const [rev, setRev] = useState(0)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      if (
        e.key === 'ironlog_logs' ||
        e.key === 'ironlog_workout_logs' ||
        e.key === 'ironlog_prs' ||
        e.key === 'ironlog_exercise_prs' ||
        e.key === 'ironlog_workouts'
      ) {
        setRev((r) => r + 1)
      }
    }
    window.addEventListener('storage', onStorage)
    const onVis = () => {
      if (document.visibilityState === 'visible') setRev((r) => r + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return rev
}

export default function Progress() {
  const navigate = useNavigate()
  const rev = useProgressDataRev()

  const data = useMemo(() => {
    void rev
    const logs = readWorkoutLogs()
    const templates = readWorkoutTemplates()
    const prs = readPersonalRecords()
    const totalTonnage = totalTonnageFromLogs(logs)
    const streak = computeCurrentStreak(logs)
    const now = new Date()
    const { start: wStart, end: wEnd } = weekRangeMonday(now)
    const { start: pStart, end: pEnd } = previousWeekRange(now)
    const thisWeekTon = tonnageInRange(logs, wStart, wEnd)
    const lastWeekTon = tonnageInRange(logs, pStart, pEnd)
    const tonPct = percentChange(thisWeekTon, lastWeekTon)
    const planned = plannedSessionsThisWeek(templates)
    const doneWeek = logs.filter((l) => {
      const t = new Date(l.savedAt).getTime()
      return t >= wStart.getTime() && t <= wEnd.getTime()
    }).length
    const prsWeek = countPrsAchievedInWeek(prs, now)
    const monthCount = countLogsThisMonth(logs, now)
    const activity = buildWeekActivity(logs, now)
    const maxDayTon = Math.max(...activity.map((d) => d.tonnage), 1)
    const milestone = getMilestoneProgress(totalTonnage)
    const topPrs = topPersonalRecords(prs, 3)

    return {
      logs,
      templates,
      prs,
      totalTonnage,
      streak,
      thisWeekTon,
      lastWeekTon,
      tonPct,
      planned,
      doneWeek,
      prsWeek,
      monthCount,
      activity,
      maxDayTon,
      milestone,
      topPrs,
    }
  }, [rev])

  const [toast, setToast] = useState<{ emoji: string; title: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearToastTimer = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
      toastTimer.current = null
    }
  }, [])

  useEffect(() => {
    const logs = readWorkoutLogs()
    const prs = readPersonalRecords()
    const totalTonnage = totalTonnageFromLogs(logs)
    const streak = computeCurrentStreak(logs)
    const unlocked = computeUnlockedAchievementIds({
      logs,
      tonnage: totalTonnage,
      prs,
      currentStreak: streak,
    })
    const { newIds } = detectNewAchievements(unlocked)
    if (newIds.length === 0) return

    let i = 0
    const showNext = () => {
      if (i >= newIds.length) return
      const def = ACHIEVEMENTS.find((a) => a.id === newIds[i])
      i += 1
      if (def) {
        setToast({ emoji: def.emoji, title: def.name })
        clearToastTimer()
        toastTimer.current = window.setTimeout(() => {
          setToast(null)
          toastTimer.current = window.setTimeout(showNext, 380)
        }, 3400)
      } else {
        showNext()
      }
    }
    showNext()
    return () => clearToastTimer()
  }, [rev, clearToastTimer])

  const unlockedSet = useMemo(
    () =>
      computeUnlockedAchievementIds({
        logs: data.logs,
        tonnage: data.totalTonnage,
        prs: data.prs,
        currentStreak: data.streak,
      }),
    [data.logs, data.prs, data.totalTonnage, data.streak],
  )

  const tonnageSubtitle =
    data.tonPct === null
      ? data.thisWeekTon > 0 && data.lastWeekTon <= 0
        ? '↑ первая неделя с объёмом'
        : '—'
      : `↑ ${data.tonPct >= 0 ? '+' : ''}${data.tonPct}% к прошлой`

  return (
    <div className="page progress-page">
      <header className="progress-header">
        <h1 className="progress-title">Прогресс</h1>
        <span className="progress-streak" aria-label={`Стрик ${data.streak} дней`}>
          🔥 {data.streak} дней
        </span>
      </header>

      <section className="progress-grid-stats" aria-label="Краткая статистика">
        <div className="progress-stat-card">
          <p className="progress-stat-card__value">{data.logs.length}</p>
          <p className="progress-stat-card__label">Тренировок всего</p>
          <p className="progress-stat-card__delta">↑ +{data.monthCount} этот месяц</p>
        </div>
        <div className="progress-stat-card">
          <p className="progress-stat-card__value">
            {data.doneWeek}/{data.planned || '—'}
          </p>
          <p className="progress-stat-card__label">Эта неделя</p>
          <p className="progress-stat-card__delta progress-stat-card__delta--muted">выполнено / запланировано</p>
        </div>
        <div className="progress-stat-card">
          <p className="progress-stat-card__value">{formatNumberKg(data.thisWeekTon)} кг</p>
          <p className="progress-stat-card__label">Тоннаж за неделю</p>
          <p
            className={
              data.tonPct === null && data.thisWeekTon === 0
                ? 'progress-stat-card__delta progress-stat-card__delta--muted'
                : 'progress-stat-card__delta'
            }
          >
            {tonnageSubtitle}
          </p>
        </div>
        <div className="progress-stat-card">
          <p className="progress-stat-card__value">{data.prs.length}</p>
          <p className="progress-stat-card__label">Личных рекордов</p>
          <p className="progress-stat-card__delta">↑ +{data.prsWeek} на этой неделе</p>
        </div>
      </section>

      <section className="progress-tonnage-hero" aria-label="Общий тоннаж и вехи">
        <h2 className="progress-tonnage-hero__title">Общий тоннаж</h2>
        <p className="progress-tonnage-hero__kg">{formatNumberKg(data.totalTonnage)} кг</p>
        <div className="progress-milestone-bar-wrap">
          <div className="progress-milestone-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(data.milestone.percent)}>
            <div className="progress-milestone-bar__fill" style={{ width: `${data.milestone.percent}%` }} />
          </div>
        </div>
        <div className="progress-milestone-labels">
          <div className="progress-milestone-labels__col">
            {data.milestone.prev ? (
              <>
                {data.milestone.prev.emoji} {data.milestone.prev.name}
                <br />
                <span aria-hidden>✓</span> достигнуто
              </>
            ) : (
              '—'
            )}
          </div>
          <div className="progress-milestone-labels__col progress-milestone-labels__col--center">
            {Math.round(data.milestone.percent)}% до цели
          </div>
          <div className="progress-milestone-labels__col">
            {data.milestone.next ? (
              <>
                {data.milestone.next.emoji} {data.milestone.next.name}
                <br />
                следующий объект
              </>
            ) : (
              'Максимум шкалы ✓'
            )}
          </div>
        </div>
      </section>

      <section className="progress-activity" aria-label="Активность за 7 дней">
        <h2 className="progress-activity__title">Активность — 7 дней</h2>
        <div className="progress-activity__bars">
          {data.activity.map((d) => {
            const hPx = d.hasWorkout ? Math.max(4, (d.tonnage / data.maxDayTon) * 80) : 3
            let barClass = 'progress-activity__bar progress-activity__bar--rest'
            if (d.hasWorkout) {
              barClass = d.isToday
                ? 'progress-activity__bar progress-activity__bar--today'
                : 'progress-activity__bar progress-activity__bar--work'
            }
            return (
              <div key={d.label + d.date.toISOString()} className="progress-activity__day">
                <div className="progress-activity__bar-track">
                  <div className={barClass} style={{ height: `${hPx}px` }} title={`${formatNumberKg(d.tonnage)} кг`} />
                </div>
                <span className="progress-activity__cap">{d.short}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="progress-pr-card" aria-label="Топ личных рекордов">
        <div className="progress-pr-card__head">
          <h2 className="progress-pr-card__title">Личные рекорды</h2>
          <button type="button" className="progress-pr-card__all" onClick={() => navigate('/profile')}>
            Все PR →
          </button>
        </div>
        {data.topPrs.length === 0 ? (
          <p className="progress-stat-card__label" style={{ margin: 0 }}>
            Пока нет сохранённых рекордов. Заверши тренировку с новым весом.
          </p>
        ) : (
          data.topPrs.map((pr) => {
            const isNew = isPrFromThisWeek(pr)
            return (
              <div
                key={`${pr.exerciseId}-${pr.achievedAt}-${pr.weight}`}
                className={`progress-pr-row${isNew ? ' progress-pr-row--new' : ''}`}
              >
                <span className="progress-pr-row__name">
                  {exerciseNameForPr(pr)}
                  {isNew ? (
                    <span className="progress-pr-row__badge" aria-label="Новый рекорд">
                      🔥 Новый!
                    </span>
                  ) : null}
                </span>
                <span className="progress-pr-row__meta">
                  {pr.weight} кг × {pr.reps || '—'} повт. · {formatPrDate(pr.achievedAt)}
                </span>
              </div>
            )
          })
        )}
      </section>

      <section className="progress-achievements" aria-label="Достижения">
        <h2 className="progress-achievements__title">Достижения</h2>
        <div className="progress-achievements__strip">
          {ACHIEVEMENTS.map((a) => {
            const ok = unlockedSet.has(a.id)
            return (
              <div
                key={a.id}
                className={`progress-achievements__item${ok ? '' : ' progress-achievements__item--locked'}`}
                title={a.name}
              >
                <span className="progress-achievements__emoji">{a.emoji}</span>
                <span className="progress-achievements__name">{a.name}</span>
              </div>
            )
          })}
        </div>
      </section>

      {toast ? (
        <div className="progress-toast" role="status">
          <span className="progress-toast__emoji">{toast.emoji}</span>
          <span className="progress-toast__text">Разблокировано: {toast.title}</span>
        </div>
      ) : null}
    </div>
  )
}
