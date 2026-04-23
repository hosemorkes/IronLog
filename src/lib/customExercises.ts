/** @deprecated Используйте функции из `db.ts`; здесь остаётся синхронный доступ к localStorage для fallback-слоя. */
export {
  CUSTOM_EXERCISES_KEY,
  localDeleteCustomExercise as deleteCustomExercise,
  localGetCustomExercises as loadCustomExercises,
  localSaveCustomExercise as addCustomExercise,
} from './localData'
