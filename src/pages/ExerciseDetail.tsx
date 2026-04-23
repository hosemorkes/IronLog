import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useWorkout } from '../context/WorkoutContext'
import { getExerciseById } from '../data/exercises'
import { deleteCustomExercise } from '../lib/customExercises'
import { readPersonalRecords, savePersonalRecords } from '../utils/stats'
import './ExerciseDetail.css'

/** Заглушка до данных из БД */
const STATS = { totalSets: 0, workouts: 0, tonnageKg: 0 }
const personalRecord: { kg: number; reps: number } | null = null

function ExerciseHeroIllustration() {
  return (
    <svg
      className="exercise-detail__hero-svg"
      viewBox="0 0 140 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="24" y="32" width="92" height="8" rx="2" fill="#3D3D48" />
      <rect x="10" y="22" width="14" height="28" rx="3" fill="#5C5C6A" />
      <rect x="116" y="22" width="14" height="28" rx="3" fill="#5C5C6A" />
      <rect x="18" y="26" width="10" height="20" rx="2" fill="#4A4A58" />
      <rect x="112" y="26" width="10" height="20" rx="2" fill="#4A4A58" />
      <circle cx="70" cy="36" r="5" fill="#7C6EF2" opacity="0.35" />
    </svg>
  )
}

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addExercise, currentWorkout, setCurrentWorkout } = useWorkout()
  const exercise = id ? getExerciseById(id) : undefined

  if (!exercise) {
    return <Navigate to="/exercises" replace />
  }

  const inCart = currentWorkout.some((w) => w.exercise.id === exercise.id)

  const handleAdd = () => {
    addExercise(exercise)
  }

  const handleDelete = () => {
    if (!exercise.isCustom) return
    if (!window.confirm('Удалить упражнение? Это действие нельзя отменить')) return
    deleteCustomExercise(exercise.id)
    setCurrentWorkout((prev) => prev.filter((w) => w.exercise.id !== exercise.id))
    savePersonalRecords(readPersonalRecords().filter((p) => p.exerciseId !== exercise.id))
    navigate('/exercises', { replace: true })
  }

  const [primaryMuscle, ...secondaryMuscles] = exercise.muscleGroups

  return (
    <div className="exercise-detail">
      <header className="exercise-detail__hero">
        <Link to="/exercises" className="exercise-detail__hero-back" aria-label="Назад к упражнениям">
          <ArrowLeft size={20} strokeWidth={2.25} />
        </Link>
        <button
          type="button"
          className="exercise-detail__hero-add"
          onClick={handleAdd}
          disabled={inCart}
        >
          {inCart ? 'Уже в тренировке' : '+ В тренировку'}
        </button>
        <div className="exercise-detail__hero-art">
          <ExerciseHeroIllustration />
        </div>
      </header>

      <div className="exercise-detail__body">
        <h1 className="exercise-detail__title">
          {exercise.name}
          {exercise.isCustom ? (
            <span className="exercise-detail__badge-mine" aria-label="Моё упражнение">
              Моё
            </span>
          ) : null}
        </h1>

        <div className="exercise-detail__tags">
          {exercise.muscleGroups.map((g) => (
            <span key={g} className="exercise-detail__tag exercise-detail__tag--muscle">
              {g}
            </span>
          ))}
          <span className="exercise-detail__tag exercise-detail__tag--equipment">{exercise.equipment}</span>
          <span className="exercise-detail__tag exercise-detail__tag--difficulty">{exercise.difficulty}</span>
        </div>

        <section className="exercise-detail__stats" aria-label="Статистика">
          <div className="exercise-detail__stat-card">
            <span className="exercise-detail__stat-value">{STATS.totalSets}</span>
            <span className="exercise-detail__stat-label">подходов всего</span>
          </div>
          <div className="exercise-detail__stat-card">
            <span className="exercise-detail__stat-value">{STATS.workouts}</span>
            <span className="exercise-detail__stat-label">тренировок</span>
          </div>
          <div className="exercise-detail__stat-card">
            <span className="exercise-detail__stat-value">{STATS.tonnageKg} кг</span>
            <span className="exercise-detail__stat-label">тоннаж</span>
          </div>
        </section>

        <section className="exercise-detail__card exercise-detail__pr" aria-label="Личный рекорд">
          <h2 className="exercise-detail__card-title">Личный рекорд</h2>
          {personalRecord ? (
            <p className="exercise-detail__pr-value">
              {personalRecord.kg} кг × {personalRecord.reps} повт.
            </p>
          ) : (
            <p className="exercise-detail__pr-empty">Ещё нет рекорда. Вперёд!</p>
          )}
        </section>

        <section className="exercise-detail__muscles" aria-label="Задействованные мышцы">
          <h2 className="exercise-detail__section-heading">Мышцы</h2>
          <div className="exercise-detail__muscle-pills">
            {primaryMuscle && (
              <span className="exercise-detail__muscle-pill exercise-detail__muscle-pill--primary">
                {primaryMuscle}
              </span>
            )}
            {secondaryMuscles.map((m) => (
              <span key={m} className="exercise-detail__muscle-pill exercise-detail__muscle-pill--secondary">
                {m}
              </span>
            ))}
          </div>
        </section>

        <section className="exercise-detail__technique" aria-label="Техника выполнения">
          <h2 className="exercise-detail__section-heading">Техника</h2>
          {exercise.instructions.length > 0 ? (
            <ol className="exercise-detail__steps">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="exercise-detail__step">
                  <span className="exercise-detail__step-num">{i + 1}</span>
                  <span className="exercise-detail__step-text">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="exercise-detail__technique-empty">Описание не добавлено.</p>
          )}
        </section>

        <button type="button" className="exercise-detail__cta" onClick={handleAdd} disabled={inCart}>
          {inCart ? 'Уже в тренировке' : 'Добавить в тренировку'}
        </button>

        {exercise.isCustom ? (
          <button type="button" className="exercise-detail__delete" onClick={handleDelete}>
            Удалить упражнение
          </button>
        ) : null}
      </div>
    </div>
  )
}
