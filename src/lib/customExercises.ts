import type { Exercise } from '../types'

export const CUSTOM_EXERCISES_KEY = 'ironlog_custom_exercises'

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

export function loadCustomExercises(): Exercise[] {
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

export function saveCustomExercises(list: Exercise[]): void {
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

export function addCustomExercise(exercise: Exercise): void {
  const list = loadCustomExercises()
  list.push({ ...exercise, isCustom: true })
  saveCustomExercises(list)
}

export function deleteCustomExercise(id: string): void {
  const list = loadCustomExercises().filter((e) => e.id !== id)
  saveCustomExercises(list)
}
