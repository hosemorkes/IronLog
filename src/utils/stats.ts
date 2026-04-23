import { getExerciseById } from '../data/exercises'
import type { WorkoutStep } from '../lib/workoutExecution'
import type { PersonalRecord, WorkoutExercise, WorkoutLogEntry, WorkoutTemplate } from '../types'

export const LOGS_STORAGE_KEYS = ['ironlog_logs', 'ironlog_workout_logs'] as const
export const WORKOUTS_STORAGE_KEY = 'ironlog_workouts'

const ACHIEVEMENT_SNAPSHOT_KEY = 'ironlog_progress_achievement_snapshot'
const PROGRESS_FIRST_VISIT_KEY = 'ironlog_progress_first_visit_done'

type StoredWorkout = Omit<WorkoutTemplate, 'createdAt'> & { createdAt: string }

export type TonnageMilestone = { kg: number; name: string; emoji: string }

export const TONNAGE_MILESTONES: TonnageMilestone[] = [
  { kg: 200, name: 'Медведь', emoji: '🐻' },
  { kg: 500, name: 'Лошадь', emoji: '🐴' },
  { kg: 1000, name: 'Малолитражка', emoji: '🚗' },
  { kg: 3000, name: '10 белых медведей', emoji: '🐻‍❄️' },
  { kg: 5000, name: 'Слон', emoji: '🐘' },
  { kg: 10000, name: 'Грузовик ГАЗель', emoji: '🚛' },
  { kg: 20000, name: 'Танк Т-72', emoji: '🪖' },
  { kg: 50000, name: 'Синий кит', emoji: '🐋' },
  { kg: 100000, name: 'Локомотив', emoji: '🚂' },
  { kg: 400000, name: 'Боинг 747', emoji: '✈️' },
  { kg: 1000000, name: 'Паром', emoji: '🛳️' },
  { kg: 5000000, name: 'МКС', emoji: '🛸' },
]

export type ProgressAchievementCtx = {
  logs: WorkoutLogEntry[]
  tonnage: number
  prs: PersonalRecord[]
  currentStreak: number
}

export type AchievementDef = {
  id: string
  name: string
  emoji: string
  check: (ctx: ProgressAchievementCtx) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_workout', name: 'Первый шаг', emoji: '🏆', check: (c) => c.logs.length >= 1 },
  { id: 'streak_7', name: '7 дней стрик', emoji: '🔥', check: (c) => c.currentStreak >= 7 },
  { id: 'streak_30', name: 'Месяц', emoji: '📅', check: (c) => c.currentStreak >= 30 },
  { id: 'bear', name: 'Поднял медведя', emoji: '🐻', check: (c) => c.tonnage >= 200 },
  { id: 'elephant', name: 'Поднял слона', emoji: '🐘', check: (c) => c.tonnage >= 5000 },
  { id: 'tank', name: 'Поднял танк', emoji: '🪖', check: (c) => c.tonnage >= 20000 },
  { id: 'train', name: 'Поднял поезд', emoji: '🚂', check: (c) => c.tonnage >= 100000 },
  { id: 'pr_first', name: 'Первый PR', emoji: '💪', check: (c) => c.prs.length >= 1 },
  { id: 'pr_10', name: '10 рекордов', emoji: '🎯', check: (c) => c.prs.length >= 10 },
  { id: 'workouts_10', name: '10 тренировок', emoji: '⚡', check: (c) => c.logs.length >= 10 },
  { id: 'workouts_50', name: '50 тренировок', emoji: '🌟', check: (c) => c.logs.length >= 50 },
  { id: 'workouts_100', name: '100 тренировок', emoji: '👑', check: (c) => c.logs.length >= 100 },
]

function parseWorkoutsRaw(raw: string | null): WorkoutTemplate[] {
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as StoredWorkout[]
    if (!Array.isArray(data)) return []
    return data.map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt),
    }))
  } catch {
    return []
  }
}

export function readWorkoutTemplates(): WorkoutTemplate[] {
  return parseWorkoutsRaw(localStorage.getItem(WORKOUTS_STORAGE_KEY))
}

export function readWorkoutLogs(): WorkoutLogEntry[] {
  for (const key of LOGS_STORAGE_KEYS) {
    const raw = localStorage.getItem(key)
    if (!raw) continue
    try {
      const o = JSON.parse(raw) as WorkoutLogEntry[]
      if (Array.isArray(o)) return o
    } catch {
      continue
    }
  }
  return []
}

function parseLegacyPrMap(raw: string | null): Record<string, number> | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null
    const rec: Record<string, number> = {}
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && Number.isFinite(v)) rec[k] = v
    }
    return rec
  } catch {
    return null
  }
}

function legacyMapToRecords(map: Record<string, number>, fallbackAt: string): PersonalRecord[] {
  return Object.entries(map).map(([exerciseId, weight]) => ({
    exerciseId,
    weight,
    reps: 0,
    achievedAt: fallbackAt,
  }))
}

/** Читает PR: массив из `ironlog_prs` или миграция из legacy Record. */
export function readPersonalRecords(): PersonalRecord[] {
  const primary = localStorage.getItem('ironlog_prs')
  if (primary) {
    try {
      const o = JSON.parse(primary) as unknown
      if (Array.isArray(o)) {
        return o
          .map((row) => row as PersonalRecord)
          .filter(
            (r) =>
              r &&
              typeof r.exerciseId === 'string' &&
              typeof r.weight === 'number' &&
              typeof r.achievedAt === 'string',
          )
          .map((r) => ({
            exerciseId: r.exerciseId,
            weight: r.weight,
            reps: typeof r.reps === 'number' ? r.reps : 0,
            achievedAt: r.achievedAt,
          }))
      }
      const asMap = parseLegacyPrMap(primary)
      if (asMap) {
        return legacyMapToRecords(asMap, new Date(0).toISOString())
      }
    } catch {
      /* fallthrough */
    }
  }

  const legacy = parseLegacyPrMap(localStorage.getItem('ironlog_exercise_prs'))
  if (legacy) return legacyMapToRecords(legacy, new Date(0).toISOString())
  return []
}

export function savePersonalRecords(prs: PersonalRecord[]): void {
  localStorage.setItem('ironlog_prs', JSON.stringify(prs))
}

export function prsArrayToMaxWeightMap(prs: PersonalRecord[]): Record<string, number> {
  const o: Record<string, number> = {}
  for (const pr of prs) {
    o[pr.exerciseId] = Math.max(o[pr.exerciseId] ?? 0, pr.weight)
  }
  return o
}

export function upgradeSessionPRs(
  existing: PersonalRecord[],
  sessionBest: Map<string, { weight: number; reps: number }>,
  savedAt: string,
): PersonalRecord[] {
  const byId = new Map<string, PersonalRecord>()
  for (const pr of existing) {
    byId.set(pr.exerciseId, pr)
  }
  for (const [exId, best] of sessionBest) {
    const cur = byId.get(exId)
    if (!cur || best.weight > cur.weight) {
      byId.set(exId, {
        exerciseId: exId,
        weight: best.weight,
        reps: best.reps,
        achievedAt: savedAt,
      })
    }
  }
  return [...byId.values()]
}

export function saveWorkoutLogs(logs: WorkoutLogEntry[]): void {
  localStorage.setItem('ironlog_logs', JSON.stringify(logs))
}

export function dateKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Понедельник текущей календарной недели (локально), 00:00 */
export function startOfWeekMonday(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return dateKeyLocal(a) === dateKeyLocal(b)
}

/** Уникальные локальные дни с хотя бы одной тренировкой, отсортированные по убыванию даты */
export function workoutDayKeysDesc(logs: WorkoutLogEntry[]): string[] {
  const set = new Set<string>()
  for (const log of logs) {
    set.add(dateKeyLocal(new Date(log.savedAt)))
  }
  return [...set].sort((x, y) => (x < y ? 1 : x > y ? -1 : 0))
}

/** Текущий стрик: подряд календарные дни с тренировкой, включая сегодня или вчера как старт */
export function computeCurrentStreak(logs: WorkoutLogEntry[]): number {
  const keys = new Set(workoutDayKeysDesc(logs))
  if (keys.size === 0) return 0

  const today = dateKeyLocal(new Date())
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const yesterday = dateKeyLocal(y)

  let cursor: Date
  if (keys.has(today)) {
    cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
  } else if (keys.has(yesterday)) {
    cursor = new Date(y)
    cursor.setHours(0, 0, 0, 0)
  } else {
    return 0
  }

  let streak = 0
  for (;;) {
    const k = dateKeyLocal(cursor)
    if (!keys.has(k)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function totalTonnageFromLogs(logs: WorkoutLogEntry[]): number {
  return logs.reduce((s, l) => s + (Number(l.tonnage) || 0), 0)
}

export function logsInCalendarMonth(logs: WorkoutLogEntry[], year: number, monthIndex: number): number {
  return logs.filter((l) => {
    const d = new Date(l.savedAt)
    return d.getFullYear() === year && d.getMonth() === monthIndex
  }).length
}

export function countLogsThisMonth(logs: WorkoutLogEntry[], now: Date = new Date()): number {
  return logsInCalendarMonth(logs, now.getFullYear(), now.getMonth())
}

export function logsBetweenInclusive(logs: WorkoutLogEntry[], start: Date, end: Date): WorkoutLogEntry[] {
  const t0 = start.getTime()
  const t1 = end.getTime()
  return logs.filter((l) => {
    const t = new Date(l.savedAt).getTime()
    return t >= t0 && t <= t1
  })
}

export function weekRangeMonday(now: Date = new Date()): { start: Date; end: Date } {
  const start = startOfWeekMonday(now)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function previousWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const { start } = weekRangeMonday(now)
  const prevEnd = new Date(start)
  prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1)
  const prevStart = startOfWeekMonday(prevEnd)
  return { start: prevStart, end: prevEnd }
}

export function tonnageInRange(logs: WorkoutLogEntry[], start: Date, end: Date): number {
  return logsBetweenInclusive(logs, start, end).reduce((s, l) => s + (Number(l.tonnage) || 0), 0)
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Math.round(((current - previous) / previous) * 100)
}

/** Запланировано на неделю: число сохранённых программ (не больше 7). */
export function plannedSessionsThisWeek(templates: WorkoutTemplate[]): number {
  if (templates.length === 0) return 0
  return Math.min(7, templates.length)
}

export function completedSessionsThisWeek(logs: WorkoutLogEntry[], now: Date = new Date()): number {
  const { start, end } = weekRangeMonday(now)
  return logsBetweenInclusive(logs, start, end).length
}

export function countPrsAchievedInWeek(prs: PersonalRecord[], now: Date = new Date()): number {
  const { start, end } = weekRangeMonday(now)
  return prs.filter((pr) => {
    const t = new Date(pr.achievedAt).getTime()
    return t >= start.getTime() && t <= end.getTime()
  }).length
}

export function getMilestoneProgress(total: number): {
  prev: TonnageMilestone | null
  next: TonnageMilestone | null
  percent: number
} {
  if (TONNAGE_MILESTONES.length === 0) {
    return { prev: null, next: null, percent: 0 }
  }
  if (total <= 0) {
    return { prev: null, next: TONNAGE_MILESTONES[0], percent: 0 }
  }
  const firstAbove = TONNAGE_MILESTONES.find((m) => m.kg > total)
  if (!firstAbove) {
    const last = TONNAGE_MILESTONES[TONNAGE_MILESTONES.length - 1]
    return { prev: last, next: null, percent: 100 }
  }
  const idx = TONNAGE_MILESTONES.indexOf(firstAbove)
  const prev = idx > 0 ? TONNAGE_MILESTONES[idx - 1] : null
  const prevKg = idx > 0 ? TONNAGE_MILESTONES[idx - 1].kg : 0
  const pct = ((total - prevKg) / (firstAbove.kg - prevKg)) * 100
  return {
    prev,
    next: firstAbove,
    percent: Math.max(0, Math.min(100, pct)),
  }
}

export type DayActivity = {
  label: string
  short: string
  date: Date
  tonnage: number
  hasWorkout: boolean
  isToday: boolean
}

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export function buildWeekActivity(logs: WorkoutLogEntry[], now: Date = new Date()): DayActivity[] {
  const start = startOfWeekMonday(now)
  const byDay = new Map<string, number>()
  for (const log of logs) {
    const d = new Date(log.savedAt)
    const k = dateKeyLocal(d)
    byDay.set(k, (byDay.get(k) ?? 0) + (Number(log.tonnage) || 0))
  }

  const out: DayActivity[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const k = dateKeyLocal(d)
    const tonnage = byDay.get(k) ?? 0
    const hasWorkout = tonnage > 0
    out.push({
      date: d,
      tonnage,
      hasWorkout,
      isToday: isSameLocalDay(d, now),
      short: WEEKDAY_SHORT[d.getDay()],
      label: WEEKDAY_SHORT[d.getDay()],
    })
  }
  return out
}

export function exerciseNameForPr(pr: PersonalRecord): string {
  return getExerciseById(pr.exerciseId)?.name ?? pr.exerciseId
}

export function topPersonalRecords(prs: PersonalRecord[], limit: number): PersonalRecord[] {
  return [...prs].sort((a, b) => b.weight - a.weight || b.reps - a.reps).slice(0, limit)
}

export function isPrFromThisWeek(pr: PersonalRecord, now: Date = new Date()): boolean {
  const { start, end } = weekRangeMonday(now)
  const t = new Date(pr.achievedAt).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

export function computeUnlockedAchievementIds(ctx: ProgressAchievementCtx): Set<string> {
  const s = new Set<string>()
  for (const a of ACHIEVEMENTS) {
    if (a.check(ctx)) s.add(a.id)
  }
  return s
}

export type NewAchievementsResult = {
  newIds: string[]
  /** Обновлённый снимок для сохранения в localStorage */
  snapshotIds: string[]
}

/** Сравнивает текущие разблокировки с прошлым снимком; первая загрузка Progress — без тостов. */
export function detectNewAchievements(currentIds: Set<string>): NewAchievementsResult {
  let firstDone = false
  try {
    firstDone = localStorage.getItem(PROGRESS_FIRST_VISIT_KEY) === '1'
  } catch {
    firstDone = false
  }

  let prev: string[] = []
  try {
    const raw = localStorage.getItem(ACHIEVEMENT_SNAPSHOT_KEY)
    if (raw) {
      const o = JSON.parse(raw) as unknown
      if (Array.isArray(o)) prev = o.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    prev = []
  }

  const prevSet = new Set(prev)
  const snapshotIds = [...currentIds].sort()

  if (!firstDone) {
    try {
      localStorage.setItem(PROGRESS_FIRST_VISIT_KEY, '1')
      localStorage.setItem(ACHIEVEMENT_SNAPSHOT_KEY, JSON.stringify(snapshotIds))
    } catch {
      /* ignore */
    }
    return { newIds: [], snapshotIds }
  }

  const newIds = [...currentIds].filter((id) => !prevSet.has(id)).sort()
  try {
    localStorage.setItem(ACHIEVEMENT_SNAPSHOT_KEY, JSON.stringify(snapshotIds))
  } catch {
    /* ignore */
  }
  return { newIds, snapshotIds }
}

export function formatPrDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export function formatNumberKg(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}

export function computeSessionBestByExercise(
  steps: WorkoutStep[],
  completed: Set<number>,
  working: WorkoutExercise[],
): Map<string, { weight: number; reps: number }> {
  const m = new Map<string, { weight: number; reps: number }>()
  for (const st of steps) {
    if (!completed.has(st.globalIndex)) continue
    const we = working[st.exerciseIndex]
    const s = we.sets[st.setIndex]
    const w = Number(s.weight)
    const r = Number(s.reps)
    const id = we.exercise.id
    const cur = m.get(id)
    if (!cur || w > cur.weight) m.set(id, { weight: w, reps: r })
  }
  return m
}
