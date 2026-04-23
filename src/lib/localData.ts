/**
 * Синхронное хранение в localStorage — fallback, если Supabase недоступен.
 */
import type { Exercise, PersonalRecord, WorkoutLogEntry, WorkoutTemplate } from '../types'

export const WORKOUTS_STORAGE_KEY = 'ironlog_workouts'
export const LOGS_STORAGE_KEYS = ['ironlog_logs', 'ironlog_workout_logs'] as const
export const CUSTOM_EXERCISES_KEY = 'ironlog_custom_exercises'

type StoredWorkout = Omit<WorkoutTemplate, 'createdAt'> & { createdAt: string }

function parseTemplates(raw: string | null): WorkoutTemplate[] {
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

function serializeTemplates(list: WorkoutTemplate[]): string {
  const stored: StoredWorkout[] = list.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))
  return JSON.stringify(stored)
}

export function localGetWorkoutTemplates(): WorkoutTemplate[] {
  return parseTemplates(localStorage.getItem(WORKOUTS_STORAGE_KEY))
}

export function localSaveWorkoutTemplate(template: WorkoutTemplate): void {
  const list = localGetWorkoutTemplates()
  const idx = list.findIndex((w) => w.id === template.id)
  if (idx >= 0) list[idx] = template
  else list.push(template)
  localStorage.setItem(WORKOUTS_STORAGE_KEY, serializeTemplates(list))
}

export function localDeleteWorkoutTemplate(id: string): void {
  const list = localGetWorkoutTemplates().filter((w) => w.id !== id)
  localStorage.setItem(WORKOUTS_STORAGE_KEY, serializeTemplates(list))
}

export function localReadWorkoutLogs(): WorkoutLogEntry[] {
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

export function localSaveWorkoutLogs(logs: WorkoutLogEntry[]): void {
  localStorage.setItem('ironlog_logs', JSON.stringify(logs))
}

export function localAppendWorkoutLog(log: WorkoutLogEntry): void {
  const logs = localReadWorkoutLogs()
  logs.push(log)
  localSaveWorkoutLogs(logs)
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

export function localReadPersonalRecords(): PersonalRecord[] {
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
      if (asMap) return legacyMapToRecords(asMap, new Date(0).toISOString())
    } catch {
      /* fallthrough */
    }
  }
  const legacy = parseLegacyPrMap(localStorage.getItem('ironlog_exercise_prs'))
  if (legacy) return legacyMapToRecords(legacy, new Date(0).toISOString())
  return []
}

export function localSavePersonalRecords(prs: PersonalRecord[]): void {
  localStorage.setItem('ironlog_prs', JSON.stringify(prs))
}

function isExerciseShape(x: unknown): x is Exercise {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.muscleGroups) &&
    typeof o.equipment === 'string' &&
    typeof o.difficulty === 'string' &&
    Array.isArray(o.instructions)
  )
}

export function localGetCustomExercises(): Exercise[] {
  try {
    const raw = localStorage.getItem(CUSTOM_EXERCISES_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter(isExerciseShape).map((e) => ({ ...e, isCustom: true as const }))
  } catch {
    return []
  }
}

export function localSaveCustomExercises(list: Exercise[]): void {
  const toStore = list.map(({ id, name, muscleGroups, equipment, difficulty, instructions }) => ({
    id,
    name,
    muscleGroups,
    equipment,
    difficulty,
    instructions,
    isCustom: true as const,
  }))
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(toStore))
}

export function localSaveCustomExercise(exercise: Exercise): void {
  const list = localGetCustomExercises()
  list.push({ ...exercise, isCustom: true })
  localSaveCustomExercises(list)
}

export function localDeleteCustomExercise(id: string): void {
  const list = localGetCustomExercises().filter((e) => e.id !== id)
  localSaveCustomExercises(list)
}
