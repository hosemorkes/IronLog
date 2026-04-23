import { useCallback, useMemo, useState } from 'react'
import type { WorkoutExercise } from '../types'
import type { WorkoutStep } from '../lib/workoutExecution'
import './ActiveWorkout.css'

type WorkoutCompleteProps = {
  name: string
  durationSeconds: number
  tonnage: number
  setsCompleted: number
  exerciseCount: number
  newPrLabels: string[]
  working: WorkoutExercise[]
  steps: WorkoutStep[]
  completed: Set<number>
  onUpdateSet: (exerciseIndex: number, setIndex: number, patch: Partial<{ weight: number; reps: number }>) => void
  onSaveLog: () => void
  onHome: () => void
  saved: boolean
  savePending?: boolean
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function WorkoutComplete({
  name,
  durationSeconds,
  tonnage,
  setsCompleted,
  exerciseCount,
  newPrLabels,
  working,
  steps,
  completed,
  onUpdateSet,
  onSaveLog,
  onHome,
  saved,
  savePending = false,
}: WorkoutCompleteProps) {
  const hasPr = newPrLabels.length > 0
  const prText = useMemo(() => newPrLabels.join(', '), [newPrLabels])

  const doneSteps = useMemo(
    () => steps.filter((st) => completed.has(st.globalIndex)).sort((a, b) => a.globalIndex - b.globalIndex),
    [steps, completed],
  )

  const [editingGlobalIndex, setEditingGlobalIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<{ weight: number; reps: number } | null>(null)

  const startEdit = useCallback(
    (st: WorkoutStep) => {
      const we = working[st.exerciseIndex]
      const set = we.sets[st.setIndex]
      setEditingGlobalIndex(st.globalIndex)
      setEditDraft({ weight: set.weight, reps: set.reps })
    },
    [working],
  )

  const cancelEdit = useCallback(() => {
    setEditingGlobalIndex(null)
    setEditDraft(null)
  }, [])

  const saveEdit = useCallback(
    (st: WorkoutStep) => {
      if (!editDraft) return
      onUpdateSet(st.exerciseIndex, st.setIndex, {
        weight: editDraft.weight,
        reps: editDraft.reps,
      })
      setEditingGlobalIndex(null)
      setEditDraft(null)
    },
    [editDraft, onUpdateSet],
  )

  return (
    <div className="workout-complete">
      <h1 className="workout-complete__title">Тренировка завершена! 💪</h1>
      <p className="workout-complete__subtitle">{name}</p>

      <section className="workout-complete__review" aria-label="Проверка результатов">
        <h2 className="workout-complete__review-title">Проверь результаты перед сохранением</h2>
        <div className="workout-complete__review-list">
          {doneSteps.map((st) => {
            const we = working[st.exerciseIndex]
            const set = we.sets[st.setIndex]
            const isEditing = editingGlobalIndex === st.globalIndex
            const rowClass = [
              'workout-complete__review-row',
              isEditing ? 'workout-complete__review-row--editing' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div
                key={st.globalIndex}
                className={rowClass}
                role={isEditing ? undefined : 'button'}
                tabIndex={isEditing ? undefined : 0}
                onClick={
                  isEditing
                    ? undefined
                    : () => {
                        startEdit(st)
                      }
                }
                onKeyDown={
                  isEditing
                    ? undefined
                    : (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          startEdit(st)
                        }
                      }
                }
              >
                <div className="workout-complete__review-main">
                  <span className="workout-complete__review-ex">{we.exercise.name}</span>
                  <span className="workout-complete__review-set">Сет {st.setIndex + 1}</span>
                </div>
                <div className="workout-complete__review-values">
                  {isEditing && editDraft ? (
                    <>
                      <input
                        className="workout-complete__review-input"
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
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Вес"
                      />
                      <input
                        className="workout-complete__review-input"
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
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Повторы"
                      />
                    </>
                  ) : (
                    <>
                      <span className="workout-complete__review-val">{set.weight || '—'} кг</span>
                      <span className="workout-complete__review-val">× {set.reps || '—'}</span>
                    </>
                  )}
                </div>
                <div className="workout-complete__review-actions" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button type="button" className="workout-complete__review-save" onClick={() => saveEdit(st)}>
                        ✓ Сохранить
                      </button>
                      <button type="button" className="workout-complete__review-cancel" onClick={cancelEdit}>
                        ✕ Отмена
                      </button>
                    </>
                  ) : (
                    <span className="workout-complete__review-tap-hint">Изменить</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {hasPr && (
        <div className="workout-complete__pr-badge" role="status">
          🏆 Новый рекорд!
        </div>
      )}
      {hasPr && <p className="workout-complete__pr-detail">Упражнения: {prText}</p>}

      <section className="workout-complete__stats" aria-label="Итоги">
        <div className="workout-complete__stat">
          <span className="workout-complete__stat-label">Время</span>
          <span className="workout-complete__stat-value">{formatDuration(durationSeconds)}</span>
        </div>
        <div className="workout-complete__stat">
          <span className="workout-complete__stat-label">Тоннаж</span>
          <span className="workout-complete__stat-value">{Math.round(tonnage)} кг</span>
        </div>
        <div className="workout-complete__stat">
          <span className="workout-complete__stat-label">Сетов</span>
          <span className="workout-complete__stat-value">{setsCompleted}</span>
        </div>
        <div className="workout-complete__stat">
          <span className="workout-complete__stat-label">Упражнений</span>
          <span className="workout-complete__stat-value">{exerciseCount}</span>
        </div>
      </section>

      <div className="workout-complete__actions">
        <button
          type="button"
          className="workout-complete__btn workout-complete__btn--primary"
          onClick={onSaveLog}
          disabled={saved || savePending}
        >
          {saved ? 'Сохранено' : savePending ? 'Сохранение…' : 'Подтвердить и сохранить'}
        </button>
        <button type="button" className="workout-complete__btn workout-complete__btn--ghost" onClick={onHome}>
          На главную
        </button>
      </div>
    </div>
  )
}
