import { useCallback, useEffect, useState } from 'react'
import type {
  Exercise,
  ExerciseDifficulty,
  ExerciseEquipment,
  ExerciseMuscleGroup,
} from '../types'
import { saveCustomExercise } from '../lib/db'
import './CreateExerciseModal.css'

const MUSCLE_OPTIONS: ExerciseMuscleGroup[] = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Кор']

const EQUIPMENT_OPTIONS: ExerciseEquipment[] = [
  'Штанга',
  'Гантели',
  'Тренажёр',
  'Своё тело',
  'Другое',
]

const DIFFICULTY_OPTIONS: ExerciseDifficulty[] = ['Лёгкий', 'Средний', 'Тяжёлый']

type CreateExerciseModalProps = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateExerciseModal({ open, onClose, onCreated }: CreateExerciseModalProps) {
  const [name, setName] = useState('')
  const [muscles, setMuscles] = useState<Set<ExerciseMuscleGroup>>(new Set())
  const [equipment, setEquipment] = useState<ExerciseEquipment>('Штанга')
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>('Средний')
  const [description, setDescription] = useState('')

  const reset = useCallback(() => {
    setName('')
    setMuscles(new Set())
    setEquipment('Штанга')
    setDifficulty('Средний')
    setDescription('')
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggleMuscle = (m: ExerciseMuscleGroup) => {
    setMuscles((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  const canSubmit = name.trim().length > 0 && muscles.size > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    const instructions = description
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const ex: Exercise = {
      id: `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      muscleGroups: [...muscles],
      equipment,
      difficulty,
      instructions,
      isCustom: true,
    }
    void saveCustomExercise(ex).then(() => {
      onCreated()
      onClose()
    })
  }

  if (!open) return null

  return (
    <div
      className="create-ex-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="create-ex-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ex-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-ex-heading" className="create-ex-sheet__title">
          Новое упражнение
        </h2>

        <div className="create-ex-sheet__scroll">
          <div>
            <label className="create-ex-field__label" htmlFor="create-ex-name">
              Название
            </label>
            <input
              id="create-ex-name"
              className="create-ex-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Жим гантелей лёжа"
              autoComplete="off"
            />
          </div>

          <div>
            <span className="create-ex-field__label">Группы мышц</span>
            <div className="create-ex-chips" role="group" aria-label="Группы мышц">
              {MUSCLE_OPTIONS.map((m) => {
                const on = muscles.has(m)
                return (
                  <button
                    key={m}
                    type="button"
                    className={
                      on ? 'create-ex-chip create-ex-chip--multi-on' : 'create-ex-chip create-ex-chip--multi-off'
                    }
                    aria-pressed={on}
                    onClick={() => toggleMuscle(m)}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="create-ex-field__label">Инвентарь</span>
            <div className="create-ex-chips" role="group" aria-label="Инвентарь">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const on = equipment === eq
                return (
                  <button
                    key={eq}
                    type="button"
                    className={
                      on ? 'create-ex-chip create-ex-chip--single-on' : 'create-ex-chip create-ex-chip--single-off'
                    }
                    aria-pressed={on}
                    onClick={() => setEquipment(eq)}
                  >
                    {eq}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="create-ex-field__label">Сложность</span>
            <div className="create-ex-chips" role="group" aria-label="Сложность">
              {DIFFICULTY_OPTIONS.map((d) => {
                const on = difficulty === d
                return (
                  <button
                    key={d}
                    type="button"
                    className={
                      on ? 'create-ex-chip create-ex-chip--single-on' : 'create-ex-chip create-ex-chip--single-off'
                    }
                    aria-pressed={on}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="create-ex-field__label" htmlFor="create-ex-desc">
              Описание техники
            </label>
            <textarea
              id="create-ex-desc"
              className="create-ex-input create-ex-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опиши технику выполнения..."
              rows={4}
            />
          </div>
        </div>

        <div className="create-ex-actions">
          <button type="button" className="create-ex-btn create-ex-btn--cancel" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="create-ex-btn create-ex-btn--submit"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Создать упражнение
          </button>
        </div>
      </div>
    </div>
  )
}
