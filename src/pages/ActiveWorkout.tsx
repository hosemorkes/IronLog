import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { buildWorkoutSteps, getRestAfterStep, type WorkoutStep } from '../lib/workoutExecution'
import type { ActiveWorkoutLocationState, PersonalRecord, WorkoutExercise } from '../types'
import { getPersonalRecords, savePersonalRecordsBatch, saveWorkoutLog, subscribeDataChanged } from '../lib/db'
import {
  computeSessionBestByExercise,
  prsArrayToMaxWeightMap,
  upgradeSessionPRs,
} from '../utils/stats'
import WorkoutComplete from './WorkoutComplete'
import './ActiveWorkout.css'

const ACTIVE_KEY = 'ironlog_active_workout'

type PersistedSession = {
  name: string
  exercises: WorkoutExercise[]
  completedGlobalIndices: number[]
  startedAtMs: number
}

function cloneExercises(ex: WorkoutExercise[]): WorkoutExercise[] {
  return JSON.parse(JSON.stringify(ex)) as WorkoutExercise[]
}

function loadPersistedSession(): PersistedSession | null {
  try {
    const r = localStorage.getItem(ACTIVE_KEY)
    if (!r) return null
    const o = JSON.parse(r) as PersistedSession
    if (!o?.name || !Array.isArray(o.exercises) || !Array.isArray(o.completedGlobalIndices)) return null
    return o
  } catch {
    return null
  }
}

function savePersistedSession(s: PersistedSession) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(s))
}

function clearPersistedSession() {
  localStorage.removeItem(ACTIVE_KEY)
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function sessionTonnage(steps: WorkoutStep[], completed: Set<number>, working: WorkoutExercise[]) {
  let t = 0
  for (const st of steps) {
    if (!completed.has(st.globalIndex)) continue
    const we = working[st.exerciseIndex]
    const set = we.sets[st.setIndex]
    t += Number(set.weight) * Number(set.reps)
  }
  return t
}

export default function ActiveWorkout() {
  const { state: navState } = useLocation()
  const navigate = useNavigate()

  const [boot, setBoot] = useState<'loading' | 'ok' | 'empty'>('loading')
  const [phase, setPhase] = useState<'active' | 'complete'>('active')
  const [name, setName] = useState('')
  const [working, setWorking] = useState<WorkoutExercise[]>([])
  const [completed, setCompleted] = useState<Set<number>>(() => new Set())
  const startedAtRef = useRef<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [restState, setRestState] = useState<{ left: number; total: number } | null>(null)
  const [restKey, setRestKey] = useState(0)
  const [logSaved, setLogSaved] = useState(false)
  const [saveLogPending, setSaveLogPending] = useState(false)
  const [editingDoneKey, setEditingDoneKey] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ weight: number; reps: number } | null>(null)
  const [hintDismissed, setHintDismissed] = useState(false)
  const [prsSnapshot, setPrsSnapshot] = useState<PersonalRecord[]>([])

  const activeInputRef = useRef<HTMLInputElement | null>(null)
  const editDoneInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const fromNav =
      navState && typeof navState === 'object' && 'exercises' in navState && Array.isArray((navState as ActiveWorkoutLocationState).exercises)
        ? (navState as ActiveWorkoutLocationState)
        : null
    const hasNav = Boolean(fromNav?.exercises?.length)
    const persisted = !hasNav ? loadPersistedSession() : null

    if (!hasNav && !persisted) {
      setBoot('empty')
      return
    }

    const src = hasNav
      ? {
          name: fromNav!.name,
          exercises: fromNav!.exercises,
          completed: [] as number[],
          startedAtMs: Date.now(),
        }
        : {
          name: persisted!.name,
          exercises: persisted!.exercises,
          completed: persisted!.completedGlobalIndices,
          startedAtMs: persisted!.startedAtMs,
        }

    if (!src.exercises.length) {
      setBoot('empty')
      return
    }

    setName(src.name)
    setWorking(cloneExercises(src.exercises))
    setCompleted(new Set(src.completed))
    startedAtRef.current = src.startedAtMs
    setElapsed(Math.max(0, Math.floor((Date.now() - src.startedAtMs) / 1000)))

    if (hasNav) {
      savePersistedSession({
        name: src.name,
        exercises: src.exercises,
        completedGlobalIndices: [],
        startedAtMs: src.startedAtMs,
      })
    }

    setBoot('ok')
  }, [navState])

  const steps = useMemo(() => buildWorkoutSteps(working), [working])

  const currentStepIndex = useMemo(() => {
    for (let i = 0; i < steps.length; i++) {
      if (!completed.has(i)) return i
    }
    return steps.length
  }, [steps, completed])

  useEffect(() => {
    void getPersonalRecords().then(setPrsSnapshot)
  }, [boot])

  useEffect(() => {
    if (boot !== 'ok') return
    return subscribeDataChanged(() => void getPersonalRecords().then(setPrsSnapshot))
  }, [boot])

  useEffect(() => {
    if (boot !== 'ok') return
    const id = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)))
    }, 1000)
    return () => window.clearInterval(id)
  }, [boot])

  useEffect(() => {
    if (boot !== 'ok' || !name || steps.length === 0) return
    savePersistedSession({
      name,
      exercises: working,
      completedGlobalIndices: [...completed],
      startedAtMs: startedAtRef.current,
    })
  }, [boot, name, working, completed, steps.length])

  useEffect(() => {
    if (boot !== 'ok' || phase !== 'active' || restState) return
    if (editingDoneKey) {
      const t = window.setTimeout(() => editDoneInputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => activeInputRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [boot, currentStepIndex, phase, restState, editingDoneKey])

  useEffect(() => {
    if (boot !== 'ok' || phase !== 'active' || restState) return
    if (steps.length > 0 && completed.size === steps.length) {
      setPhase('complete')
    }
  }, [boot, phase, restState, steps.length, completed])

  useEffect(() => {
    if (!restState) return
    const id = window.setInterval(() => {
      setRestState((prev) => {
        if (!prev) return null
        if (prev.left <= 1) {
          window.clearInterval(id)
          window.setTimeout(() => activeInputRef.current?.focus(), 0)
          return null
        }
        return { ...prev, left: prev.left - 1 }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [restKey])

  const updateWorkingSet = useCallback(
    (exerciseIndex: number, setIndex: number, patch: Partial<{ weight: number; reps: number }>) => {
      setWorking((prev) =>
        prev.map((we, wi) => {
          if (wi !== exerciseIndex) return we
          return {
            ...we,
            sets: we.sets.map((s, si) => (si === setIndex ? { ...s, ...patch } : s)),
          }
        }),
      )
    },
    [],
  )

  const completeCurrentStep = useCallback(() => {
    if (boot !== 'ok' || phase !== 'active' || restState || editingDoneKey) return
    const g = currentStepIndex
    if (g >= steps.length) return

    setCompleted((prev) => {
      const next = new Set(prev)
      next.add(g)
      return next
    })

    const rest = getRestAfterStep(working, steps, g)
    if (rest.show && rest.seconds > 0) {
      setRestState({ left: rest.seconds, total: rest.seconds })
      setRestKey((k) => k + 1)
    }
  }, [boot, phase, restState, editingDoneKey, currentStepIndex, steps, working])

  const skipRest = useCallback(() => {
    setRestState(null)
    setRestKey((k) => k + 1)
    window.setTimeout(() => activeInputRef.current?.focus(), 0)
  }, [])

  const finishEarly = useCallback(() => {
    setPhase('complete')
  }, [])

  const tonnage = useMemo(() => sessionTonnage(steps, completed, working), [steps, completed, working])

  const progress = steps.length > 0 ? completed.size / steps.length : 0

  const uniqueExerciseCount = useMemo(() => new Set(working.map((w) => w.exercise.id)).size, [working])

  const curStep = currentStepIndex < steps.length ? steps[currentStepIndex] : null
  const curWe = curStep ? working[curStep.exerciseIndex] : null

  useEffect(() => {
    setEditingDoneKey(null)
    setEditDraft(null)
  }, [curWe?.id])

  const nextPreview = useMemo(() => {
    if (currentStepIndex >= steps.length - 1) return null
    const ns = steps[currentStepIndex + 1]
    if (!ns) return null
    const we = working[ns.exerciseIndex]
    const reps = we.sets[ns.setIndex]?.reps ?? 0
    return `${we.exercise.name} · ${we.sets.length} сетов × ${reps} повт.`
  }, [steps, currentStepIndex, working])

  const completionStats = useMemo(() => {
    const setsDone = completed.size
    const exCount = uniqueExerciseCount
    const sessionBest = computeSessionBestByExercise(steps, completed, working)
    const oldPrs = prsArrayToMaxWeightMap(prsSnapshot)
    const newPrLabels: string[] = []
    for (const [exId, best] of sessionBest) {
      if (best.weight > (oldPrs[exId] ?? 0)) {
        const ex = working.find((x) => x.exercise.id === exId)?.exercise
        if (ex) newPrLabels.push(ex.name)
      }
    }
    return {
      durationSeconds: elapsed,
      tonnage: sessionTonnage(steps, completed, working),
      setsCompleted: setsDone,
      exerciseCount: exCount,
      newPrLabels,
      sessionBest,
    }
  }, [steps, completed, working, elapsed, uniqueExerciseCount, prsSnapshot])

  const handleSaveLog = useCallback(() => {
    if (saveLogPending || logSaved) return
    setSaveLogPending(true)
    const savedAt = new Date().toISOString()
    const entry = {
      id: crypto.randomUUID(),
      savedAt,
      name,
      durationSeconds: completionStats.durationSeconds,
      tonnage: Math.round(completionStats.tonnage),
      setsCompleted: completionStats.setsCompleted,
      exerciseCount: completionStats.exerciseCount,
    }
    const merged = upgradeSessionPRs(prsSnapshot, completionStats.sessionBest, savedAt)
    void Promise.all([saveWorkoutLog(entry), savePersonalRecordsBatch(merged)])
      .then(() => {
        setPrsSnapshot(merged)
        clearPersistedSession()
        setLogSaved(true)
      })
      .finally(() => setSaveLogPending(false))
  }, [name, completionStats, prsSnapshot, saveLogPending, logSaved])

  const handleHome = useCallback(() => {
    clearPersistedSession()
    navigate('/workout', { replace: true })
  }, [navigate])

  if (boot === 'loading') {
    return (
      <div className="active-workout active-workout--loading" aria-busy="true">
        Загрузка…
      </div>
    )
  }

  if (boot === 'empty') {
    return <Navigate to="/workout" replace />
  }

  if (phase === 'complete') {
    return (
      <WorkoutComplete
        name={name}
        durationSeconds={completionStats.durationSeconds}
        tonnage={completionStats.tonnage}
        setsCompleted={completionStats.setsCompleted}
        exerciseCount={completionStats.exerciseCount}
        newPrLabels={completionStats.newPrLabels}
        working={working}
        steps={steps}
        completed={completed}
        onUpdateSet={updateWorkingSet}
        onSaveLog={handleSaveLog}
        onHome={handleHome}
        saved={logSaved}
        savePending={saveLogPending}
      />
    )
  }

  const currentSetDisplay = Math.min(completed.size + 1, Math.max(1, steps.length))
  const c = 2 * Math.PI * 52
  const restProgress = restState ? 1 - restState.left / restState.total : 0

  return (
    <div className="active-workout">
      <header className="active-workout__top">
        <h1 className="active-workout__title">{name}</h1>
        <div className="active-workout__timer" aria-live="polite">
          {formatClock(elapsed)}
        </div>
        <button type="button" className="active-workout__finish" onClick={finishEarly}>
          Завершить
        </button>
      </header>

      <div className="active-workout__progress-wrap">
        <div
          className="active-workout__progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="active-workout__progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="active-workout__progress-label">
          Сет {currentSetDisplay} из {steps.length} · {uniqueExerciseCount} упражнений
        </p>
      </div>

      {restState && (
        <div className="active-workout__rest">
          <div className="active-workout__rest-inner">
            <div className="active-workout__rest-ring-wrap">
              <svg className="active-workout__rest-svg" viewBox="0 0 120 120" aria-hidden>
                <circle className="active-workout__rest-track" cx="60" cy="60" r="52" fill="none" strokeWidth="8" />
                <circle
                  className="active-workout__rest-progress"
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - restProgress)}
                />
              </svg>
              <span className="active-workout__rest-count">{restState.left}</span>
            </div>
            <p className="active-workout__rest-goal">Цель: {restState.total} секунд</p>
            <button type="button" className="active-workout__rest-skip" onClick={skipRest}>
              Пропустить
            </button>
          </div>
        </div>
      )}

      {curWe && curStep && (
        <>
          <section className="active-workout__current-card" aria-label="Текущее упражнение">
            <span className="active-workout__now-label">СЕЙЧАС</span>
            <h2 className="active-workout__ex-name">{curWe.exercise.name}</h2>
            <p className="active-workout__ex-meta">
              {curWe.exercise.muscleGroups.join(' · ')} · {curWe.exercise.equipment}
            </p>
          </section>

          <div className="active-workout__table-wrap" role="region" aria-label="Сеты">
            <div className="active-workout__table-head">
              <span>№</span>
              <span>Вес кг</span>
              <span>Повторы</span>
              <span>Предыдущий</span>
              <span className="active-workout__th-check">✓</span>
            </div>
            {curWe.sets.map((set, sIdx) => {
              const st = steps.find((x) => x.weId === curWe.id && x.setIndex === sIdx)
              const gIdx = st?.globalIndex ?? -1
              const isDone = gIdx >= 0 && completed.has(gIdx)
              const isActive = gIdx >= 0 && currentStepIndex === gIdx && !isDone
              const isPending = gIdx >= 0 && !isDone && !isActive
              const rowKey = `${curWe.id}:${sIdx}`
              const isEditingDone = Boolean(isDone && editingDoneKey === rowKey && editDraft)

              const rowClass = [
                'active-workout__row',
                isPending ? 'active-workout__row--pending' : '',
                isDone && !isEditingDone ? 'active-workout__row--done' : '',
                isActive ? 'active-workout__row--active' : '',
                isEditingDone ? 'active-workout__row--editing-done' : '',
                isDone && !isEditingDone && !restState ? 'active-workout__row--done-clickable' : '',
              ]
                .filter(Boolean)
                .join(' ')

              const openDoneEdit = () => {
                if (!isDone || isEditingDone || restState) return
                setEditingDoneKey(rowKey)
                setEditDraft({ weight: set.weight, reps: set.reps })
              }

              const saveDoneEdit = () => {
                if (!editDraft) return
                updateWorkingSet(curStep.exerciseIndex, sIdx, {
                  weight: editDraft.weight,
                  reps: editDraft.reps,
                })
                setEditingDoneKey(null)
                setEditDraft(null)
                setHintDismissed(true)
              }

              const cancelDoneEdit = () => {
                setEditingDoneKey(null)
                setEditDraft(null)
              }

              return (
                <div
                  key={set.id}
                  className={rowClass}
                  role="row"
                  onClick={isDone && !isEditingDone ? openDoneEdit : undefined}
                  onKeyDown={
                    isDone && !isEditingDone
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openDoneEdit()
                          }
                        }
                      : undefined
                  }
                  tabIndex={isDone && !isEditingDone && !restState ? 0 : undefined}
                >
                  <span className="active-workout__cell-num">{sIdx + 1}</span>
                  <div className="active-workout__cell" onClick={(e) => isEditingDone && e.stopPropagation()}>
                    {isEditingDone && editDraft ? (
                      <input
                        ref={editDoneInputRef}
                        className="active-workout__input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        value={editDraft.weight === 0 ? '' : editDraft.weight}
                        onChange={(e) => {
                          const v = e.target.value
                          setEditDraft((d) =>
                            d ? { ...d, weight: v === '' ? 0 : Number(v) } : d,
                          )
                        }}
                        aria-label={`Вес, сет ${sIdx + 1}`}
                      />
                    ) : isActive ? (
                      <input
                        ref={activeInputRef}
                        className="active-workout__input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        value={set.weight === 0 ? '' : set.weight}
                        onChange={(e) => {
                          const v = e.target.value
                          updateWorkingSet(curStep.exerciseIndex, sIdx, {
                            weight: v === '' ? 0 : Number(v),
                          })
                        }}
                        aria-label={`Вес, сет ${sIdx + 1}`}
                      />
                    ) : (
                      <span className="active-workout__cell-static">{isPending ? '—' : set.weight || '—'}</span>
                    )}
                  </div>
                  <div className="active-workout__cell" onClick={(e) => isEditingDone && e.stopPropagation()}>
                    {isEditingDone && editDraft ? (
                      <input
                        className="active-workout__input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={editDraft.reps === 0 ? '' : editDraft.reps}
                        onChange={(e) => {
                          const v = e.target.value
                          setEditDraft((d) =>
                            d ? { ...d, reps: v === '' ? 0 : Number(v) } : d,
                          )
                        }}
                        aria-label={`Повторы, сет ${sIdx + 1}`}
                      />
                    ) : isActive ? (
                      <input
                        className="active-workout__input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={set.reps === 0 ? '' : set.reps}
                        onChange={(e) => {
                          const v = e.target.value
                          updateWorkingSet(curStep.exerciseIndex, sIdx, {
                            reps: v === '' ? 0 : Number(v),
                          })
                        }}
                        aria-label={`Повторы, сет ${sIdx + 1}`}
                      />
                    ) : (
                      <span className="active-workout__cell-static">{isPending ? '—' : set.reps || '—'}</span>
                    )}
                  </div>
                  <span className="active-workout__cell-prev">—</span>
                  <div
                    className={`active-workout__cell-check${isEditingDone ? ' active-workout__cell-check--stack' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isEditingDone ? (
                      <>
                        <button type="button" className="active-workout__edit-save" onClick={saveDoneEdit}>
                          ✓ Сохранить
                        </button>
                        <button type="button" className="active-workout__edit-cancel" onClick={cancelDoneEdit}>
                          ✕ Отмена
                        </button>
                      </>
                    ) : isDone ? (
                      <span className="active-workout__check active-workout__check--done" aria-hidden>
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="active-workout__check"
                        disabled={!isActive || Boolean(restState)}
                        onClick={completeCurrentStep}
                        aria-label={`Отметить сет ${sIdx + 1}`}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {!hintDismissed && (
            <p className="active-workout__hint">Нажми на выполненный сет чтобы изменить</p>
          )}
        </>
      )}

      <section className="active-workout__mini" aria-label="Статистика">
        <div className="active-workout__mini-card">
          <span className="active-workout__mini-label">Время</span>
          <span className="active-workout__mini-value">{formatClock(elapsed)}</span>
        </div>
        <div className="active-workout__mini-card">
          <span className="active-workout__mini-label">Тоннаж</span>
          <span className="active-workout__mini-value">{Math.round(tonnage)} кг</span>
        </div>
        <div className="active-workout__mini-card">
          <span className="active-workout__mini-label">Сетов</span>
          <span className="active-workout__mini-value">{completed.size}</span>
        </div>
      </section>

      {nextPreview && <p className="active-workout__next">Следующее: {nextPreview}</p>}

      <button
        type="button"
        className="active-workout__big-done"
        disabled={
          !curStep || Boolean(restState) || Boolean(editingDoneKey) || currentStepIndex >= steps.length
        }
        onClick={completeCurrentStep}
      >
        Сет выполнен ✓
      </button>
    </div>
  )
}
