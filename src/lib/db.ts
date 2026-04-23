import { getExerciseById as getBuiltInExerciseById } from '../data/exercises'
import type { Exercise, PersonalRecord, WorkoutLogEntry, WorkoutTemplate } from '../types'
import { supabase } from './supabase'
import {
  localAppendWorkoutLog,
  localDeleteCustomExercise,
  localDeleteWorkoutTemplate,
  localGetCustomExercises,
  localGetWorkoutTemplates,
  localReadPersonalRecords,
  localReadWorkoutLogs,
  localSaveCustomExercise,
  localSavePersonalRecords,
  localSaveWorkoutTemplate,
} from './localData'

export type WorkoutLog = WorkoutLogEntry

const CHANGED = 'ironlog-db-changed'

export function notifyDataChanged(): void {
  window.dispatchEvent(new CustomEvent(CHANGED))
}

export function subscribeDataChanged(cb: () => void): () => void {
  window.addEventListener(CHANGED, cb)
  return () => window.removeEventListener(CHANGED, cb)
}

function mapTemplateRow(row: {
  id: string
  name: string
  exercises: unknown
  created_at: string
}): WorkoutTemplate {
  return {
    id: row.id,
    name: row.name,
    exercises: row.exercises as WorkoutTemplate['exercises'],
    createdAt: new Date(row.created_at),
  }
}

function mapLogRow(row: {
  id: string
  saved_at: string
  name: string
  duration_seconds: number
  tonnage: number
  sets_completed: number
  exercise_count: number
}): WorkoutLogEntry {
  return {
    id: row.id,
    savedAt: row.saved_at,
    name: row.name,
    durationSeconds: row.duration_seconds,
    tonnage: row.tonnage,
    setsCompleted: row.sets_completed,
    exerciseCount: row.exercise_count,
  }
}

function mapPrRow(row: {
  exercise_id: string
  weight: number
  reps: number
  achieved_at: string
}): PersonalRecord {
  return {
    exerciseId: row.exercise_id,
    weight: row.weight,
    reps: row.reps,
    achievedAt: row.achieved_at,
  }
}

// ——— Шаблоны ———

export async function getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  if (!supabase) return localGetWorkoutTemplates()
  try {
    const { data, error } = await supabase
      .from('workout_templates')
      .select('id,name,exercises,created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapTemplateRow)
  } catch {
    return localGetWorkoutTemplates()
  }
}

export async function saveWorkoutTemplate(template: WorkoutTemplate): Promise<void> {
  if (!supabase) {
    localSaveWorkoutTemplate(template)
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('workout_templates').upsert(
      {
        id: template.id,
        name: template.name,
        exercises: template.exercises,
        created_at: template.createdAt.toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) throw error
    notifyDataChanged()
  } catch {
    localSaveWorkoutTemplate(template)
    notifyDataChanged()
  }
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  if (!supabase) {
    localDeleteWorkoutTemplate(id)
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('workout_templates').delete().eq('id', id)
    if (error) throw error
    notifyDataChanged()
  } catch {
    localDeleteWorkoutTemplate(id)
    notifyDataChanged()
  }
}

// ——— Логи ———

export async function getWorkoutLogs(): Promise<WorkoutLogEntry[]> {
  if (!supabase) return localReadWorkoutLogs()
  try {
    const { data, error } = await supabase
      .from('workout_logs')
      .select('id,saved_at,name,duration_seconds,tonnage,sets_completed,exercise_count')
      .order('saved_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapLogRow)
  } catch {
    return localReadWorkoutLogs()
  }
}

export async function saveWorkoutLog(log: WorkoutLogEntry): Promise<void> {
  if (!supabase) {
    localAppendWorkoutLog(log)
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('workout_logs').insert({
      id: log.id,
      saved_at: log.savedAt,
      name: log.name,
      duration_seconds: log.durationSeconds,
      tonnage: log.tonnage,
      sets_completed: log.setsCompleted,
      exercise_count: log.exerciseCount,
    })
    if (error) throw error
    notifyDataChanged()
  } catch {
    localAppendWorkoutLog(log)
    notifyDataChanged()
  }
}

// ——— PR ———

export async function getPersonalRecords(): Promise<PersonalRecord[]> {
  if (!supabase) return localReadPersonalRecords()
  try {
    const { data, error } = await supabase
      .from('personal_records')
      .select('exercise_id,weight,reps,achieved_at')
    if (error) throw error
    return (data ?? []).map(mapPrRow)
  } catch {
    return localReadPersonalRecords()
  }
}

export async function savePersonalRecord(pr: PersonalRecord): Promise<void> {
  if (!supabase) {
    const list = localReadPersonalRecords()
    const idx = list.findIndex((x) => x.exerciseId === pr.exerciseId)
    if (idx >= 0) list[idx] = pr
    else list.push(pr)
    localSavePersonalRecords(list)
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('personal_records').upsert(
      {
        exercise_id: pr.exerciseId,
        weight: pr.weight,
        reps: pr.reps,
        achieved_at: pr.achievedAt,
      },
      { onConflict: 'exercise_id' },
    )
    if (error) throw error
    notifyDataChanged()
  } catch {
    const list = localReadPersonalRecords()
    const idx = list.findIndex((x) => x.exerciseId === pr.exerciseId)
    if (idx >= 0) list[idx] = pr
    else list.push(pr)
    localSavePersonalRecords(list)
    notifyDataChanged()
  }
}

/** Пакетное сохранение PR (после тренировки). */
export async function savePersonalRecordsBatch(prs: PersonalRecord[]): Promise<void> {
  if (!supabase) {
    localSavePersonalRecords(prs)
    notifyDataChanged()
    return
  }
  try {
    const rows = prs.map((pr) => ({
      exercise_id: pr.exerciseId,
      weight: pr.weight,
      reps: pr.reps,
      achieved_at: pr.achievedAt,
    }))
    const { error } = await supabase.from('personal_records').upsert(rows, { onConflict: 'exercise_id' })
    if (error) throw error
    notifyDataChanged()
  } catch {
    localSavePersonalRecords(prs)
    notifyDataChanged()
  }
}

export async function getExercisePR(exerciseId: string): Promise<PersonalRecord | null> {
  if (!supabase) {
    return localReadPersonalRecords().find((p) => p.exerciseId === exerciseId) ?? null
  }
  try {
    const { data, error } = await supabase
      .from('personal_records')
      .select('exercise_id,weight,reps,achieved_at')
      .eq('exercise_id', exerciseId)
      .maybeSingle()
    if (error) throw error
    return data ? mapPrRow(data) : null
  } catch {
    return localReadPersonalRecords().find((p) => p.exerciseId === exerciseId) ?? null
  }
}

// ——— Кастомные упражнения ———

export async function getCustomExercises(): Promise<Exercise[]> {
  if (!supabase) return localGetCustomExercises()
  try {
    const { data, error } = await supabase.from('custom_exercises').select('id,exercise')
    if (error) throw error
    return (data ?? []).map((row) => {
      const ex = row.exercise as Exercise
      return { ...ex, isCustom: true as const }
    })
  } catch {
    return localGetCustomExercises()
  }
}

export async function saveCustomExercise(exercise: Exercise): Promise<void> {
  if (!supabase) {
    localSaveCustomExercise({ ...exercise, isCustom: true })
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('custom_exercises').upsert(
      {
        id: exercise.id,
        exercise: { ...exercise, isCustom: true },
      },
      { onConflict: 'id' },
    )
    if (error) throw error
    notifyDataChanged()
  } catch {
    localSaveCustomExercise({ ...exercise, isCustom: true })
    notifyDataChanged()
  }
}

export async function resolveExerciseById(id: string): Promise<Exercise | undefined> {
  const built = getBuiltInExerciseById(id)
  if (built) return built
  const list = await getCustomExercises()
  return list.find((e) => e.id === id)
}

export async function deleteCustomExercise(id: string): Promise<void> {
  if (!supabase) {
    localDeleteCustomExercise(id)
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('custom_exercises').delete().eq('id', id)
    if (error) throw error
    notifyDataChanged()
  } catch {
    localDeleteCustomExercise(id)
    notifyDataChanged()
  }
}

/** Удалить PR по упражнению (при удалении кастомного). */
export async function deletePersonalRecordsForExercise(exerciseId: string): Promise<void> {
  if (!supabase) {
    const next = localReadPersonalRecords().filter((p) => p.exerciseId !== exerciseId)
    localSavePersonalRecords(next)
    notifyDataChanged()
    return
  }
  try {
    const { error } = await supabase.from('personal_records').delete().eq('exercise_id', exerciseId)
    if (error) throw error
    notifyDataChanged()
  } catch {
    const next = localReadPersonalRecords().filter((p) => p.exerciseId !== exerciseId)
    localSavePersonalRecords(next)
    notifyDataChanged()
  }
}
