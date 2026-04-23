import { useCallback, useMemo, useState } from 'react'
import type { WorkoutTemplate } from '../types'

export const WORKOUTS_STORAGE_KEY = 'ironlog_workouts'

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

export function getWorkouts(): WorkoutTemplate[] {
  return parseTemplates(localStorage.getItem(WORKOUTS_STORAGE_KEY))
}

export function saveWorkout(template: WorkoutTemplate): void {
  const list = getWorkouts()
  const idx = list.findIndex((w) => w.id === template.id)
  if (idx >= 0) {
    list[idx] = template
  } else {
    list.push(template)
  }
  localStorage.setItem(WORKOUTS_STORAGE_KEY, serializeTemplates(list))
}

export function deleteWorkout(id: string): void {
  const list = getWorkouts().filter((w) => w.id !== id)
  localStorage.setItem(WORKOUTS_STORAGE_KEY, serializeTemplates(list))
}

export function useWorkouts() {
  const [tick, setTick] = useState(0)

  const workouts = useMemo(() => {
    void tick
    return getWorkouts()
  }, [tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const saveWorkoutAndRefresh = useCallback(
    (template: WorkoutTemplate) => {
      saveWorkout(template)
      refresh()
    },
    [refresh],
  )

  const deleteWorkoutAndRefresh = useCallback(
    (id: string) => {
      deleteWorkout(id)
      refresh()
    },
    [refresh],
  )

  return {
    workouts,
    saveWorkout: saveWorkoutAndRefresh,
    getWorkouts,
    deleteWorkout: deleteWorkoutAndRefresh,
    refresh,
  }
}
