import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { Exercise, WorkoutExercise } from '../types'

function newId() {
  return crypto.randomUUID()
}

export function createWorkoutExerciseFromLibrary(exercise: Exercise): WorkoutExercise {
  return {
    id: newId(),
    exercise,
    sets: [
      { id: newId(), weight: 0, reps: 0 },
      { id: newId(), weight: 0, reps: 0 },
      { id: newId(), weight: 0, reps: 0 },
    ],
    restSeconds: 90,
    supersetGroup: undefined,
  }
}

type WorkoutContextValue = {
  currentWorkout: WorkoutExercise[]
  addExercise: (exercise: Exercise) => void
  removeExercise: (id: string) => void
  clearWorkout: () => void
  setCurrentWorkout: Dispatch<SetStateAction<WorkoutExercise[]>>
  totalExercises: number
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutExercise[]>([])

  const addExercise = useCallback((exercise: Exercise) => {
    setCurrentWorkout((prev) => {
      if (prev.some((w) => w.exercise.id === exercise.id)) return prev
      return [...prev, createWorkoutExerciseFromLibrary(exercise)]
    })
  }, [])

  const removeExercise = useCallback((id: string) => {
    setCurrentWorkout((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const clearWorkout = useCallback(() => {
    setCurrentWorkout([])
  }, [])

  const totalExercises = currentWorkout.length

  const value = useMemo(
    () => ({
      currentWorkout,
      addExercise,
      removeExercise,
      clearWorkout,
      setCurrentWorkout,
      totalExercises,
    }),
    [currentWorkout, addExercise, removeExercise, clearWorkout, setCurrentWorkout],
  )

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
}

export function useWorkout() {
  const ctx = useContext(WorkoutContext)
  if (!ctx) {
    throw new Error('useWorkout must be used within WorkoutProvider')
  }
  return ctx
}
