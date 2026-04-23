import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkouts } from '../hooks/useWorkouts'
import './WorkoutList.css'

function formatWorkoutDate(d: Date) {
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function exerciseCountLabel(n: number) {
  const m = n % 100
  const m1 = n % 10
  if (m >= 11 && m <= 14) return `${n} упражнений`
  if (m1 === 1) return `${n} упражнение`
  if (m1 >= 2 && m1 <= 4) return `${n} упражнения`
  return `${n} упражнений`
}

export default function WorkoutList() {
  const navigate = useNavigate()
  const { workouts } = useWorkouts()

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [workouts],
  )

  return (
    <div className="workout-list page">
      <header className="workout-list__header">
        <h1 className="workout-list__title">Тренировки</h1>
        <button type="button" className="workout-list__new" onClick={() => navigate('/workout/new')}>
          + Новая тренировка
        </button>
      </header>

      {sorted.length === 0 ? (
        <p className="workout-list__empty">Создай первую тренировку</p>
      ) : (
        <ul className="workout-list__items">
          {sorted.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="workout-list__card"
                onClick={() => navigate(`/workout/${w.id}`)}
              >
                <span className="workout-list__card-name">{w.name}</span>
                <span className="workout-list__card-meta">{exerciseCountLabel(w.exercises.length)}</span>
                <span className="workout-list__card-date">{formatWorkoutDate(w.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
