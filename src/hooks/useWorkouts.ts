import { useCallback, useEffect, useState } from 'react'
import type { WorkoutTemplate } from '../types'
import { deleteWorkoutTemplate, getWorkoutTemplates, saveWorkoutTemplate, subscribeDataChanged } from '../lib/db'

export { WORKOUTS_STORAGE_KEY } from '../lib/localData'

export async function getWorkouts(): Promise<WorkoutTemplate[]> {
  return getWorkoutTemplates()
}

export async function saveWorkout(template: WorkoutTemplate): Promise<void> {
  await saveWorkoutTemplate(template)
}

export async function deleteWorkout(id: string): Promise<void> {
  await deleteWorkoutTemplate(id)
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getWorkoutTemplates()
      setWorkouts(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      setWorkouts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => subscribeDataChanged(() => void refresh()), [refresh])

  const saveWorkoutAndRefresh = useCallback(
    async (template: WorkoutTemplate) => {
      await saveWorkoutTemplate(template)
      await refresh()
    },
    [refresh],
  )

  const deleteWorkoutAndRefresh = useCallback(
    async (id: string) => {
      await deleteWorkoutTemplate(id)
      await refresh()
    },
    [refresh],
  )

  return {
    workouts,
    loading,
    error,
    saveWorkout: saveWorkoutAndRefresh,
    deleteWorkout: deleteWorkoutAndRefresh,
    refresh,
  }
}
