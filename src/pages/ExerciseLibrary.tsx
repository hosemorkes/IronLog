import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import CreateExerciseModal from '../components/CreateExerciseModal'
import { useWorkout } from '../context/WorkoutContext'
import { EXERCISES } from '../data/exercises'
import { getCustomExercises, subscribeDataChanged } from '../lib/db'
import type { Exercise, ExerciseMuscleGroup, ExerciseSelectNavState, WorkoutBuilderPickState } from '../types'
import './ExerciseLibrary.css'

const MUSCLE_FILTERS: Array<'Все' | ExerciseMuscleGroup> = [
  'Все',
  'Грудь',
  'Спина',
  'Ноги',
  'Плечи',
  'Руки',
  'Кор',
]

function normalizeQuery(q: string) {
  return q.trim().toLowerCase()
}

export default function ExerciseLibrary() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const selectMode = searchParams.get('mode') === 'select'
  const { currentWorkout, addExercise } = useWorkout()
  const [query, setQuery] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<'Все' | ExerciseMuscleGroup>('Все')
  const [createOpen, setCreateOpen] = useState(false)
  const [customExercises, setCustomExercises] = useState<Exercise[]>([])
  const [loadingCustom, setLoadingCustom] = useState(true)

  const refreshCustom = useCallback(async () => {
    setLoadingCustom(true)
    try {
      const list = await getCustomExercises()
      setCustomExercises(list)
    } finally {
      setLoadingCustom(false)
    }
  }, [])

  useEffect(() => {
    void refreshCustom()
  }, [refreshCustom])

  useEffect(() => subscribeDataChanged(() => void refreshCustom()), [refreshCustom])

  const allExercises = useMemo(
    () => [...EXERCISES, ...customExercises],
    [customExercises],
  )

  const filtered = useMemo(() => {
    const nq = normalizeQuery(query)
    return allExercises.filter((ex) => {
      if (nq && !ex.name.toLowerCase().includes(nq)) return false
      if (muscleFilter !== 'Все' && !ex.muscleGroups.includes(muscleFilter)) return false
      return true
    })
  }, [query, muscleFilter, allExercises])

  const isInCart = (ex: Exercise) => currentWorkout.some((w) => w.exercise.id === ex.id)

  const openExercise = (ex: Exercise) => {
    if (selectMode) {
      const nav = location.state as ExerciseSelectNavState | null
      const returnPath = nav?.builderReturnPath ?? '/workout/new'
      const state: WorkoutBuilderPickState = { selectedExercise: ex }
      navigate(returnPath, { state })
      return
    }
    navigate(`/exercises/${ex.id}`)
  }

  if (loadingCustom) {
    return (
      <div className="page exercise-library ironlog-page-loading" aria-busy="true">
        <p className="ironlog-page-loading__text">Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="page exercise-library">
      <div className="exercise-library__top">
        <h1 className="exercise-library__title">
          {selectMode ? 'Выберите упражнение' : 'Упражнения'}
        </h1>
        <button
          type="button"
          className="exercise-library__fab-add"
          aria-label="Создать упражнение"
          onClick={() => setCreateOpen(true)}
        >
          +
        </button>
      </div>

      <CreateExerciseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void refreshCustom()}
      />

      <input
        type="search"
        className="exercise-library__search"
        placeholder="Поиск по названию…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />

      <div className="exercise-library__chips-outer">
        <div className="exercise-library__chips" role="tablist" aria-label="Фильтр по мышцам">
          {MUSCLE_FILTERS.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={muscleFilter === m}
              className={
                muscleFilter === m
                  ? 'exercise-library__chip exercise-library__chip--active'
                  : 'exercise-library__chip'
              }
              onClick={() => setMuscleFilter(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="exercise-library__empty">Ничего не найдено</p>
      ) : (
        <ul className="exercise-library__list">
          {filtered.map((ex) => {
            const inCart = isInCart(ex)
            return (
              <li key={ex.id} className="exercise-library__item">
                <button type="button" className="exercise-library__card-main" onClick={() => openExercise(ex)}>
                  <div className="exercise-library__card-body">
                    <h2 className="exercise-library__card-name">
                      <span className="exercise-library__name-row">
                        {ex.name}
                        {ex.isCustom ? (
                          <span className="exercise-library__badge-mine" aria-label="Моё упражнение">
                            Моё
                          </span>
                        ) : null}
                      </span>
                    </h2>
                    <div className="exercise-library__tags">
                      {ex.muscleGroups.map((g) => (
                        <span key={g} className="exercise-library__tag exercise-library__tag--muscle">
                          {g}
                        </span>
                      ))}
                      <span className="exercise-library__tag exercise-library__tag--equipment">
                        {ex.equipment}
                      </span>
                    </div>
                  </div>
                  <span className="exercise-library__trail" aria-hidden>
                    {inCart ? (
                      <span className="exercise-library__check">✓</span>
                    ) : selectMode ? (
                      <span className="exercise-library__select-pill exercise-library__select-pill--inline">
                        Выбрать
                      </span>
                    ) : (
                      <ChevronRight className="exercise-library__chevron" />
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="exercise-library__add-cart"
                  disabled={inCart}
                  onClick={() => addExercise(ex)}
                >
                  + Добавить
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
