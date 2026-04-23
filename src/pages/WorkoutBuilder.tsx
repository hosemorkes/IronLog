import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useMatch, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Dumbbell, GripVertical, X } from 'lucide-react'
import { createWorkoutExerciseFromLibrary, useWorkout } from '../context/WorkoutContext'
import { getWorkouts, saveWorkout } from '../hooks/useWorkouts'
import type {
  ActiveWorkoutLocationState,
  ExerciseSelectNavState,
  WorkoutBuilderPickState,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
} from '../types'
import './WorkoutBuilder.css'

function newId() {
  return crypto.randomUUID()
}

const MAX_SUPERSET = 3

function ensureThreeSets(sets: WorkoutSet[]): WorkoutSet[] {
  if (sets.length >= 3) return sets
  const next = [...sets]
  while (next.length < 3) {
    next.push({ id: newId(), weight: 0, reps: 0 })
  }
  return next
}

function getContiguousBounds(list: WorkoutExercise[], i: number): [number, number] {
  const g = list[i].supersetGroup
  if (!g) return [i, i]
  let lo = i
  while (lo > 0 && list[lo - 1].supersetGroup === g) lo--
  let hi = i
  while (hi < list.length - 1 && list[hi + 1].supersetGroup === g) hi++
  return [lo, hi]
}

function nextSupersetLabel(list: WorkoutExercise[]): string {
  const used = new Set(
    list.map((w) => w.supersetGroup).filter((x): x is string => Boolean(x)),
  )
  for (let c = 'A'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const L = String.fromCharCode(c)
    if (!used.has(L)) return L
  }
  return newId().slice(0, 6).toUpperCase()
}

function mergeWithNeighbor(
  list: WorkoutExercise[],
  index: number,
  dir: 'prev' | 'next',
): WorkoutExercise[] | null {
  const neighbor = dir === 'prev' ? index - 1 : index + 1
  if (neighbor < 0 || neighbor >= list.length) return null

  const leftIdx = Math.min(index, neighbor)
  const rightIdx = Math.max(index, neighbor)

  const leftBounds = getContiguousBounds(list, leftIdx)
  const rightBounds = getContiguousBounds(list, rightIdx)

  if (leftBounds[1] + 1 !== rightBounds[0]) return null

  const lo = leftBounds[0]
  const hi = rightBounds[1]
  const count = hi - lo + 1
  if (count > MAX_SUPERSET) return null

  const slice = list.slice(lo, hi + 1)
  const existingLabels = new Set(slice.map((s) => s.supersetGroup).filter(Boolean) as string[])

  let label: string
  if (existingLabels.size === 1) {
    label = [...existingLabels][0]
  } else {
    label = nextSupersetLabel(list)
  }

  return list.map((we, idx) => (idx >= lo && idx <= hi ? { ...we, supersetGroup: label } : we))
}

function buildDisplayGroups(
  list: WorkoutExercise[],
): Array<
  | { kind: 'superset'; group: string; items: WorkoutExercise[] }
  | { kind: 'single'; item: WorkoutExercise }
> {
  const out: Array<
    | { kind: 'superset'; group: string; items: WorkoutExercise[] }
    | { kind: 'single'; item: WorkoutExercise }
  > = []
  let i = 0
  while (i < list.length) {
    const g = list[i].supersetGroup
    if (!g) {
      out.push({ kind: 'single', item: list[i] })
      i++
      continue
    }
    let j = i
    while (j < list.length && list[j].supersetGroup === g) j++
    const chunk = list.slice(i, j)
    if (chunk.length >= 2) {
      out.push({ kind: 'superset', group: g, items: chunk })
    } else {
      out.push({ kind: 'single', item: chunk[0] })
    }
    i = j
  }
  return out
}

function countSupersetGroups(list: WorkoutExercise[]): number {
  let n = 0
  let i = 0
  while (i < list.length) {
    const g = list[i].supersetGroup
    if (!g) {
      i++
      continue
    }
    let j = i
    while (j < list.length && list[j].supersetGroup === g) j++
    if (j - i >= 2) n++
    i = j
  }
  return n
}

function isLastInSupersetBlock(list: WorkoutExercise[], index: number): boolean {
  const g = list[index].supersetGroup
  if (!g) return true
  return index === list.length - 1 || list[index + 1].supersetGroup !== g
}

export default function WorkoutBuilder() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeId } = useParams<{ id: string }>()
  const isNew = useMatch({ path: '/workout/new', end: true }) != null
  const { currentWorkout, setCurrentWorkout, clearWorkout } = useWorkout()
  const cartRef = useRef(currentWorkout)
  cartRef.current = currentWorkout

  const [workoutName, setWorkoutName] = useState('')
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [originalCreatedAt, setOriginalCreatedAt] = useState<Date | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [toast, setToast] = useState(false)
  const [supersetPromptIdx, setSupersetPromptIdx] = useState<number | null>(null)

  const pickConsumed = useRef<string | null>(null)
  const newTemplateIdRef = useRef<string | null>(null)

  useEffect(() => {
    pickConsumed.current = null
    setSupersetPromptIdx(null)
    if (isNew) {
      newTemplateIdRef.current = null
      setWorkoutName('')
      setOriginalCreatedAt(null)
      setExercises(
        cartRef.current.map((w) => ({
          ...w,
          sets: ensureThreeSets(w.sets),
        })),
      )
      setHydrated(true)
      return
    }
    if (routeId) {
      void getWorkouts()
        .then((list) => {
          const found = list.find((w) => w.id === routeId)
          if (!found) {
            navigate('/workout', { replace: true })
            return
          }
          setWorkoutName(found.name)
          setExercises(
            found.exercises.map((w) => ({
              ...w,
              sets: ensureThreeSets(w.sets),
            })),
          )
          setOriginalCreatedAt(found.createdAt)
          setHydrated(true)
        })
        .catch(() => {
          navigate('/workout', { replace: true })
        })
    }
  }, [isNew, routeId, navigate, location.key])

  useEffect(() => {
    if (!isNew || !hydrated) return
    setCurrentWorkout(exercises)
  }, [exercises, isNew, hydrated, setCurrentWorkout])

  useEffect(() => {
    const st = location.state as WorkoutBuilderPickState | null
    if (!st?.selectedExercise) return
    const sig = `${st.selectedExercise.id}:${location.key}`
    if (pickConsumed.current === sig) return
    pickConsumed.current = sig
    setExercises((prev) => [...prev, createWorkoutExerciseFromLibrary(st.selectedExercise)])
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state, location.key, location.pathname, navigate])

  const totals = useMemo(() => {
    let setCount = 0
    let tonnage = 0
    for (const we of exercises) {
      setCount += we.sets.length
      for (const s of we.sets) {
        tonnage += Number(s.weight) * Number(s.reps)
      }
    }
    const estMinutes = setCount * 3
    return {
      exerciseCount: exercises.length,
      supersetCount: countSupersetGroups(exercises),
      setCount,
      estMinutes,
      tonnage: Math.round(tonnage),
    }
  }, [exercises])

  const displayGroups = useMemo(() => buildDisplayGroups(exercises), [exercises])

  const handleBack = () => {
    navigate('/workout')
  }

  const handleSave = () => {
    const templateId = isNew ? (newTemplateIdRef.current ??= newId()) : routeId!
    const template: WorkoutTemplate = {
      id: templateId,
      name: workoutName.trim() || 'Без названия',
      exercises,
      createdAt: originalCreatedAt ?? new Date(),
    }
    void saveWorkout(template).then(() => {
      if (isNew) clearWorkout()
      setToast(true)
      window.setTimeout(() => setToast(false), 2000)
      window.setTimeout(() => navigate('/workout'), 2000)
    })
  }

  const handleClearAll = () => {
    clearWorkout()
    setExercises([])
    setSupersetPromptIdx(null)
  }

  const addSet = useCallback((weId: string) => {
    setExercises((prev) =>
      prev.map((we) =>
        we.id === weId
          ? { ...we, sets: [...we.sets, { id: newId(), weight: 0, reps: 0 }] }
          : we,
      ),
    )
  }, [])

  const removeSet = useCallback((weId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((we) => {
        if (we.id !== weId) return we
        if (we.sets.length <= 1) return we
        return { ...we, sets: we.sets.filter((s) => s.id !== setId) }
      }),
    )
  }, [])

  const updateSet = useCallback((weId: string, setId: string, patch: Partial<WorkoutSet>) => {
    setExercises((prev) =>
      prev.map((we) => {
        if (we.id !== weId) return we
        return {
          ...we,
          sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        }
      }),
    )
  }, [])

  const setRest = useCallback((weId: string, rest: 60 | 90 | 120) => {
    setExercises((prev) => prev.map((we) => (we.id === weId ? { ...we, restSeconds: rest } : we)))
  }, [])

  const tryMerge = (index: number, dir: 'prev' | 'next') => {
    setExercises((prev) => {
      const next = mergeWithNeighbor(prev, index, dir)
      if (!next) {
        window.alert(`Суперсет не больше ${MAX_SUPERSET} упражнений или нет соседа.`)
        return prev
      }
      return next
    })
    setSupersetPromptIdx(null)
  }

  const addExerciseNavigate = () => {
    const nav: ExerciseSelectNavState = { builderReturnPath: location.pathname }
    navigate('/exercises?mode=select', { state: nav })
  }

  const startWorkout = () => {
    if (exercises.length === 0) return
    const payload: ActiveWorkoutLocationState = {
      name: workoutName.trim() || 'Тренировка',
      exercises,
    }
    navigate('/workout/active', { state: payload })
  }

  const exerciseIndex = (we: WorkoutExercise) => exercises.findIndex((x) => x.id === we.id)

  const renderExerciseCard = (we: WorkoutExercise) => {
    const idx = exerciseIndex(we)
    const showRest = isLastInSupersetBlock(exercises, idx)

    return (
      <li key={we.id} className="workout-builder__exercise-card">
        <div className="workout-builder__card-head">
          <div className="workout-builder__card-head-main">
            <span className="workout-builder__card-icon" aria-hidden>
              <Dumbbell size={20} strokeWidth={2} />
            </span>
            <div className="workout-builder__card-titles">
              <span className="workout-builder__card-name">{we.exercise.name}</span>
              <span className="workout-builder__card-muscles">
                {we.exercise.muscleGroups.join(' · ')}
              </span>
            </div>
          </div>
          <GripVertical className="workout-builder__drag" size={20} aria-hidden />
        </div>

        <div className="workout-builder__superset-actions">
          <button
            type="button"
            className="workout-builder__superset-btn"
            onClick={() => setSupersetPromptIdx(supersetPromptIdx === idx ? null : idx)}
          >
            ⚡ Суперсет
          </button>
          {supersetPromptIdx === idx && (
            <div className="workout-builder__superset-prompt">
              <span className="workout-builder__superset-prompt-title">Объединить с:</span>
              <div className="workout-builder__superset-prompt-btns">
                <button type="button" disabled={idx <= 0} onClick={() => tryMerge(idx, 'prev')}>
                  Предыдущим
                </button>
                <button
                  type="button"
                  disabled={idx >= exercises.length - 1}
                  onClick={() => tryMerge(idx, 'next')}
                >
                  Следующим
                </button>
                <button type="button" className="workout-builder__superset-prompt-cancel" onClick={() => setSupersetPromptIdx(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="workout-builder__sets" role="table" aria-label="Подходы">
          <div className="workout-builder__sets-head" role="row">
            <span role="columnheader">№</span>
            <span role="columnheader">Вес кг</span>
            <span role="columnheader">Повторы</span>
            <span role="columnheader" className="workout-builder__sets-head-actions" />
          </div>
          {we.sets.map((set, rowIdx) => (
            <div
              key={set.id}
              className={`workout-builder__sets-row${rowIdx % 2 === 1 ? ' workout-builder__sets-row--alt' : ''}`}
              role="row"
            >
              <span className="workout-builder__sets-num" role="cell">
                {rowIdx + 1}
              </span>
              <div role="cell">
                <input
                  className="workout-builder__cell-input"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={set.weight === 0 ? '' : set.weight}
                  onChange={(e) => {
                    const v = e.target.value
                    updateSet(we.id, set.id, {
                      weight: v === '' ? 0 : Number(v),
                    })
                  }}
                  aria-label={`Вес, сет ${rowIdx + 1}`}
                />
              </div>
              <div role="cell">
                <input
                  className="workout-builder__cell-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={set.reps === 0 ? '' : set.reps}
                  onChange={(e) => {
                    const v = e.target.value
                    updateSet(we.id, set.id, {
                      reps: v === '' ? 0 : Number(v),
                    })
                  }}
                  aria-label={`Повторы, сет ${rowIdx + 1}`}
                />
              </div>
              <div role="cell" className="workout-builder__sets-actions">
                <button
                  type="button"
                  className="workout-builder__remove-set"
                  onClick={() => removeSet(we.id, set.id)}
                  disabled={we.sets.length <= 1}
                  aria-label={`Удалить сет ${rowIdx + 1}`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="workout-builder__add-set" onClick={() => addSet(we.id)}>
          + Добавить сет
        </button>

        {showRest ? (
          <div className="workout-builder__rest">
            <span className="workout-builder__rest-label">
              {we.supersetGroup ? 'Отдых после суперсета' : 'Отдых'}
            </span>
            <div className="workout-builder__rest-pills">
              {([60, 90, 120] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={
                    we.restSeconds === sec
                      ? 'workout-builder__rest-pill workout-builder__rest-pill--active'
                      : 'workout-builder__rest-pill'
                  }
                  onClick={() => setRest(we.id, sec)}
                >
                  {sec}с
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="workout-builder__rest-skip">Без отдыха до конца суперсета</p>
        )}
      </li>
    )
  }

  if (!hydrated) {
    return <div className="workout-builder workout-builder--loading" aria-busy="true" />
  }

  return (
    <div className="workout-builder">
      {toast && (
        <div className="workout-builder__toast" role="status" aria-live="polite">
          Тренировка сохранена!
        </div>
      )}

      <header className="workout-builder__header">
        <button type="button" className="workout-builder__icon-btn" onClick={handleBack} aria-label="Назад">
          <ArrowLeft size={22} strokeWidth={2.25} />
        </button>
        <div className="workout-builder__header-center">
          <h1 className="workout-builder__heading">{isNew ? 'Новая тренировка' : 'Редактирование'}</h1>
          {isNew && (
            <button type="button" className="workout-builder__clear-all" onClick={handleClearAll}>
              Очистить всё
            </button>
          )}
        </div>
        <button type="button" className="workout-builder__save" onClick={handleSave}>
          Сохранить
        </button>
      </header>

      <label className="workout-builder__name-label">
        <span className="visually-hidden">Название тренировки</span>
        <input
          className="workout-builder__name-input"
          type="text"
          value={workoutName}
          onChange={(e) => setWorkoutName(e.target.value)}
          placeholder="Название тренировки..."
          autoComplete="off"
        />
      </label>

      <div className="workout-builder__exercise-blocks">
        {displayGroups.map((block, bi) => {
          if (block.kind === 'single') {
            return (
              <ul key={block.item.id} className="workout-builder__exercise-list workout-builder__exercise-list--solo">
                {renderExerciseCard(block.item)}
              </ul>
            )
          }
          return (
            <div key={`ss-${block.group}-${bi}`} className="workout-builder__superset">
              <div className="workout-builder__superset-label" aria-hidden>
                Суперсет {block.group}
              </div>
              <ul className="workout-builder__exercise-list workout-builder__exercise-list--stack">
                {block.items.map((we) => renderExerciseCard(we))}
              </ul>
            </div>
          )
        })}
      </div>

      <button type="button" className="workout-builder__add-exercise" onClick={addExerciseNavigate}>
        + Добавить упражнение
      </button>

      <section className="workout-builder__summary" aria-label="Итого">
        <div className="workout-builder__summary-row">
          <span className="workout-builder__summary-label">Упражнений</span>
          <span className="workout-builder__summary-value">{totals.exerciseCount}</span>
        </div>
        <div className="workout-builder__summary-row">
          <span className="workout-builder__summary-label">Суперсетов</span>
          <span className="workout-builder__summary-value">{totals.supersetCount}</span>
        </div>
        <div className="workout-builder__summary-row">
          <span className="workout-builder__summary-label">Сетов</span>
          <span className="workout-builder__summary-value">{totals.setCount}</span>
        </div>
        <div className="workout-builder__summary-row">
          <span className="workout-builder__summary-label">Примерное время</span>
          <span className="workout-builder__summary-value">{totals.estMinutes} мин</span>
        </div>
        <div className="workout-builder__summary-row">
          <span className="workout-builder__summary-label">Тоннаж</span>
          <span className="workout-builder__summary-value">{totals.tonnage} кг</span>
        </div>
      </section>

      <button
        type="button"
        className="workout-builder__start"
        onClick={startWorkout}
        disabled={exercises.length === 0}
      >
        Начать тренировку
      </button>
    </div>
  )
}
