export type ExerciseEquipment = 'Штанга' | 'Гантели' | 'Тренажёр' | 'Своё тело' | 'Другое'

export type ExerciseDifficulty = 'Лёгкий' | 'Средний' | 'Тяжёлый'

/** Основные группы мышц для фильтров и тегов */
export type ExerciseMuscleGroup =
  | 'Грудь'
  | 'Спина'
  | 'Ноги'
  | 'Плечи'
  | 'Руки'
  | 'Кор'

export interface Exercise {
  id: string
  name: string
  muscleGroups: ExerciseMuscleGroup[]
  equipment: ExerciseEquipment
  difficulty: ExerciseDifficulty
  instructions: string[]
  /** Пользовательское упражнение из localStorage */
  isCustom?: true
}

export interface WorkoutSet {
  id: string
  weight: number
  reps: number
}

export interface WorkoutExercise {
  id: string
  exercise: Exercise
  sets: WorkoutSet[]
  restSeconds: 60 | 90 | 120
  /** Одинаковая метка — одна суперсерия (только соседние в списке) */
  supersetGroup?: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: WorkoutExercise[]
  createdAt: Date
}

/** location.state при возврате из библиотеки в режиме выбора */
export interface WorkoutBuilderPickState {
  selectedExercise: Exercise
}

/** location.state при открытии библиотеки из конструктора (куда вернуться после выбора) */
export interface ExerciseSelectNavState {
  builderReturnPath?: string
}

/** location.state для экрана активной тренировки */
export interface ActiveWorkoutLocationState {
  name: string
  exercises: WorkoutExercise[]
}

/** Сохранённый лог завершённой тренировки */
export interface WorkoutLogEntry {
  id: string
  savedAt: string
  name: string
  durationSeconds: number
  tonnage: number
  setsCompleted: number
  exerciseCount: number
}

/** Личный рекорд (хранится в localStorage `ironlog_prs`) */
export interface PersonalRecord {
  exerciseId: string
  weight: number
  reps: number
  achievedAt: string
}
