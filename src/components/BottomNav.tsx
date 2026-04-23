import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardList, Dumbbell, TrendingUp, User } from 'lucide-react'
import { useWorkout } from '../context/WorkoutContext'

const navClass = (active: boolean) =>
  `bottom-nav__link${active ? ' bottom-nav__link--active' : ''}`

export function BottomNav() {
  const { pathname } = useLocation()
  const { totalExercises } = useWorkout()

  const exercisesActive = pathname === '/exercises' || pathname.startsWith('/exercises/')
  const workoutActive = pathname.startsWith('/workout')
  const progressActive = pathname === '/progress'
  const profileActive = pathname === '/profile'

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      <NavLink to="/exercises" className={() => navClass(exercisesActive)}>
        <Dumbbell className="bottom-nav__icon" aria-hidden />
        <span>Упражнения</span>
      </NavLink>
      <NavLink to="/workout" className={() => navClass(workoutActive)}>
        <span className="bottom-nav__icon-wrap">
          <ClipboardList className="bottom-nav__icon" aria-hidden />
          {totalExercises > 0 && (
            <span className="bottom-nav__badge">{totalExercises > 99 ? '99+' : totalExercises}</span>
          )}
        </span>
        <span>Тренировка</span>
      </NavLink>
      <NavLink to="/progress" className={() => navClass(progressActive)}>
        <TrendingUp className="bottom-nav__icon" aria-hidden />
        <span>Прогресс</span>
      </NavLink>
      <NavLink to="/profile" className={() => navClass(profileActive)}>
        <User className="bottom-nav__icon" aria-hidden />
        <span>Профиль</span>
      </NavLink>
    </nav>
  )
}
