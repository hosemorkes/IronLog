import { supabase } from './supabase'
import {
  CUSTOM_EXERCISES_KEY,
  WORKOUTS_STORAGE_KEY,
  localReadPersonalRecords,
  localReadWorkoutLogs,
} from './localData'

const MIGRATED_KEY = 'ironlog_migrated'

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Однократный перенос данных из localStorage в Supabase.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (!supabase) return
  if (localStorage.getItem(MIGRATED_KEY) === 'true') return

  try {
    const templatesRaw = localStorage.getItem(WORKOUTS_STORAGE_KEY)
    const templates = parseJson<Array<{ id: string; name: string; exercises: unknown; createdAt: string }>>(
      templatesRaw,
    )
    if (templates?.length) {
      const rows = templates.map((t) => ({
        id: t.id,
        name: t.name,
        exercises: t.exercises,
        created_at: t.createdAt,
      }))
      const { error } = await supabase.from('workout_templates').upsert(rows, { onConflict: 'id' })
      if (error) throw error
    }

    const logs = localReadWorkoutLogs()
    if (logs.length) {
      const rows = logs.map((l) => ({
        id: l.id,
        saved_at: l.savedAt,
        name: l.name,
        duration_seconds: l.durationSeconds,
        tonnage: l.tonnage,
        sets_completed: l.setsCompleted,
        exercise_count: l.exerciseCount,
      }))
      const { error } = await supabase.from('workout_logs').upsert(rows, { onConflict: 'id' })
      if (error) throw error
    }

    const prs = localReadPersonalRecords()
    if (prs.length) {
      const rows = prs.map((p) => ({
        exercise_id: p.exerciseId,
        weight: p.weight,
        reps: p.reps,
        achieved_at: p.achievedAt,
      }))
      const { error } = await supabase.from('personal_records').upsert(rows, { onConflict: 'exercise_id' })
      if (error) throw error
    }

    const customRaw = localStorage.getItem(CUSTOM_EXERCISES_KEY)
    const custom = parseJson<Array<Record<string, unknown>>>(customRaw)
    if (custom?.length) {
      const rows = custom
        .filter((c) => typeof c.id === 'string')
        .map((c) => ({ id: c.id as string, exercise: c }))
      if (rows.length) {
        const { error } = await supabase.from('custom_exercises').upsert(rows, { onConflict: 'id' })
        if (error) throw error
      }
    }

    localStorage.setItem(MIGRATED_KEY, 'true')
  } catch (e) {
    console.error('[IronLog] migrateFromLocalStorage failed', e)
  }
}
